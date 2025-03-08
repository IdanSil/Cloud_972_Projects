-- Step 1: Checking max length for each column
-- Later I will drop the table and recreate it with the right types, limits, checks
SELECT
    MAX(LENGTH(title::TEXT))
FROM netflix_raw;

-- Step 2: Table Creation
CREATE TABLE netflix_raw
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

-- Step 3: Deduplication
-- I'm checking to see which titles have duplicates,
-- then check broader context to make sure they actually are duplicates
SELECT * FROM netflix_raw
WHERE CONCAT(upper(title), type) in (
SELECT CONCAT(upper(title), type)
FROM netflix_raw
GROUP BY upper(title), type
HAVING COUNT(*)>1)
ORDER BY title;

-- We learnt that pairs of title, type create unique values.
WITH cte as (
    SELECT *,
           row_number() over (partition by title, type order by show_id) as rn
    FROM netflix_raw
)

SELECT * FROM cte
WHERE rn = 1
ORDER BY show_id; -- Providing a dedupped table



-- Step 4: Split multiple valued columns to separate tables (Cast, Country, Genres, Directors)
SELECT show_id, TRIM(unnested_director) AS director
INTO netflix_directors
from netflix_raw
CROSS JOIN LATERAL UNNEST(string_to_array(director, ',')) AS unnested_director;

SELECT show_id, TRIM(unnested_cast) AS cast
INTO netflix_cast
from netflix_raw
CROSS JOIN LATERAL UNNEST(string_to_array("cast", ',')) AS unnested_cast;

SELECT show_id, TRIM(unnested_countries) AS country
INTO netflix_countries
from netflix_raw
CROSS JOIN LATERAL UNNEST(string_to_array(country, ',')) AS unnested_countries;

SELECT show_id, TRIM(unnested_genres) AS genre
INTO netflix_genres
from netflix_raw
CROSS JOIN LATERAL UNNEST(string_to_array(listed_in, ',')) AS unnested_genres;


-- Step 5: Master Data Table
WITH cte as (
    SELECT *,
           row_number() over (partition by title, type order by show_id) as rn
    FROM netflix_raw
)

SELECT show_id, type, title, date_added, release_year, rating, case when duration is null then rating else duration end, description
INTO netflix
FROM cte
WHERE rn = 1
ORDER BY show_id;

-- Step 6: Populate missing values
SELECT show_id, country from netflix_raw
WHERE country is null;

SELECT * FROM netflix_countries
WHERE show_id='s3';

-- We'll create a mapping of similar possible matches, to help populate nulls.
-- lets make an assumption that a director usually directs movies in the same countries

SELECT director, country
FROM netflix_countries nc
INNER JOIN netflix_directors nd on nc.show_id = nd.show_id
GROUP BY director, country;

-- lets use this mapping to populate null values
INSERT INTO netflix_countries
SELECT show_id, m.country from netflix_raw nr
inner join (
    SELECT director, country
    FROM netflix_countries nc
             INNER JOIN netflix_directors nd on nc.show_id = nd.show_id
    GROUP BY director, country
) m on m.director = nr.director
WHERE nr.country is null
ORDER BY show_id;

-- Now duration column:

SELECT rating as duration from netflix_raw
where duration is null;
