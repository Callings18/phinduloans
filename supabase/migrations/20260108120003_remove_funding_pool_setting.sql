-- Remove deprecated static funding_pool setting in favor of real account balances
delete from system_settings where key = 'funding_pool';

