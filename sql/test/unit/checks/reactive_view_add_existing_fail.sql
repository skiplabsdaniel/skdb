CREATE TABLE IF NOT EXISTS test(x integer);
DELETE FROM TEST;
INSERT INTO test VALUES (-10);
CREATE REACTIVE VIEW testpos AS SELECT CHECK(x > 0) FROM test;
SELECT * FROM test;
