-- جداول نظام المحاسبة

-- تفعيل RLS (أمان مستوى الصف)
alter table if exists public.profiles force row level security;

-- جدول الحسابات (زبائن، موردين، موظفين)
create table if not exists public.accounts (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    type text check (type in ('customer', 'supplier', 'employee')) not null,
    phone text,
    email text,
    address text,
    initial_balance numeric(12,2) default 0,
    current_balance numeric(12,2) default 0,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    user_id uuid references auth.users(id) on delete cascade
);

-- جدول العمليات المالية
create table if not exists public.operations (
    id uuid default gen_random_uuid() primary key,
    type text check (type in ('sell', 'buy', 'payment', 'expense')) not null,
    account_id uuid references public.accounts(id) on delete set null,
    date date not null default current_date,
    currency text check (currency in ('USD', 'TRY', 'SYP')) default 'USD',
    amount numeric(12,2) not null,
    exchange_rate numeric(8,4) default 1,
    direction text check (direction in ('incoming', 'outgoing')) default 'outgoing',
    
    -- حقول الوقود (اختيارية)
    fuel_type text check (fuel_type in ('diesel', 'petrol')),
    weight numeric(10,2),
    density numeric(6,3) default 0.835,
    barrels numeric(8,2),
    barrel_price numeric(10,2),
    
    -- بيانات إضافية
    notes text,
    reference_number text,
    
    -- تكامل Google Sheets
    synced_with_gsheets boolean default false,
    gsheets_row_id text,
    
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    user_id uuid references auth.users(id) on delete cascade
);

-- جدول أسعار الصرف التاريخية
create table if not exists public.exchange_rates (
    id uuid default gen_random_uuid() primary key,
    from_currency text not null,
    to_currency text not null,
    rate numeric(12,6) not null,
    date date not null default current_date,
    source text,
    created_at timestamptz default now()
);

-- جدول الصندوق اليومي
create table if not exists public.daily_cash (
    id uuid default gen_random_uuid() primary key,
    date date not null default current_date,
    currency text not null,
    opening_balance numeric(12,2) default 0,
    closing_balance numeric(12,2),
    actual_balance numeric(12,2),
    difference numeric(12,2),
    notes text,
    reconciled boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    user_id uuid references auth.users(id) on delete cascade,
    unique(date, currency)
);

-- جدول الإعدادات
create table if not exists public.app_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz default now(),
    user_id uuid references auth.users(id) on delete cascade
);

-- إنشاء فهارس للأداء
create index if not exists idx_operations_account on public.operations(account_id);
create index if not exists idx_operations_date on public.operations(date);
create index if not exists idx_operations_type on public.operations(type);
create index if not exists idx_operations_user on public.operations(user_id);
create index if not exists idx_accounts_user on public.accounts(user_id);
create index if not exists idx_daily_cash_date on public.daily_cash(date);

-- دالة لتحديث التاريخ التلقائي
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- تفعيل التحديث التلقائي
create trigger update_accounts_updated_at before update on public.accounts
    for each row execute function update_updated_at_column();
    
create trigger update_operations_updated_at before update on public.operations
    for each row execute function update_updated_at_column();
    
create trigger update_daily_cash_updated_at before update on public.daily_cash
    for each row execute function update_updated_at_column();

-- سياسات الأمان (RLS)

-- سياسة للحسابات: المستخدم يرى فقط حساباته
alter table public.accounts enable row level security;

create policy "Users can only access their own accounts"
    on public.accounts for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- سياسة للعمليات: المستخدم يرى فقط عملياته
alter table public.operations enable row level security;

create policy "Users can only access their own operations"
    on public.operations for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- سياسة للصندوق: المستخدم يرى فONLY بياناته
alter table public.daily_cash enable row level security;

create policy "Users can only access their own cash records"
    on public.daily_cash for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- دالة حساب رصيد الحساب تلقائياً
create or replace function calculate_account_balance(account_uuid uuid)
returns numeric as $$
declare
    total_sell numeric;
    total_buy numeric;
    total_incoming numeric;
    total_outgoing numeric;
    initial_bal numeric;
begin
    -- الحصول على الرصيد الافتتاحي
    select initial_balance into initial_bal 
    from public.accounts where id = account_uuid;
    
    -- مجموع المبيعات (لنا)
    select coalesce(sum(amount * exchange_rate), 0) into total_sell
    from public.operations
    where account_id = account_uuid and type = 'sell';
    
    -- مجموع المشتريات (علينا)
    select coalesce(sum(amount * exchange_rate), 0) into total_buy
    from public.operations
    where account_id = account_uuid and type = 'buy';
    
    -- الدفعات الواردة (لنا)
    select coalesce(sum(amount * exchange_rate), 0) into total_incoming
    from public.operations
    where account_id = account_uuid and type = 'payment' and direction = 'incoming';
    
    -- الدفعات الصادرة (علينا)
    select coalesce(sum(amount * exchange_rate), 0) into total_outgoing
    from public.operations
    where account_id = account_uuid and type = 'payment' and direction = 'outgoing';
    
    -- الرصيد = الافتتاحي + المبيعات + الواردة - المشتريات - الصادرة
    return initial_bal + total_sell + total_incoming - total_buy - total_outgoing;
end;
$$ language plpgsql;

-- دالة لتحديث الرصيد تلقائياً عند إضافة عملية
create or replace function update_account_balance_on_operation()
returns trigger as $$
begin
    if new.account_id is not null then
        update public.accounts 
        set current_balance = calculate_account_balance(new.account_id),
            updated_at = now()
        where id = new.account_id;
    end if;
    return new;
end;
$$ language plpgsql;

create trigger update_balance_after_operation
    after insert or update on public.operations
    for each row execute function update_account_balance_on_operation();