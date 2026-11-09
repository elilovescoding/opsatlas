-- The JDBC principal index must support the full email length accepted by users.
ALTER TABLE spring_session ALTER COLUMN principal_name TYPE varchar(254);
