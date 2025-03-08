-- Step 2: Table Creation
CREATE TABLE IF NOT EXISTS netflix_raw
(
    show_id      varchar(10) PRIMARY KEY,
    type         varchar(10),
    title        varchar(200),
    director     varchar(300),
    "cast"       varchar(1000),
    country      varchar(150),
    date_added   date,
    release_year int,
    rating       varchar(20),
    duration     varchar(20),
    listed_in    varchar(100),
    description  varchar(300)
); 