-- How many movies and tv shows did any director film? show only for directors who did both tv and movies

with types_and_directors as (SELECT n.show_id, n.type, nd.director
from netflix n
Inner Join public.netflix_directors nd on n.show_id = nd.show_id)

SELECT director,
       sum(CASE WHEN type='Movie' THEN 1 ELSE 0 END) as movies,
       sum(CASE WHEN type='TV Show' THEN 1 ELSE 0 END) as tv_show
from types_and_directors
group by director
having sum(CASE WHEN type='Movie' THEN 1 ELSE 0 END) > 0
   AND sum(CASE WHEN type='TV Show' THEN 1 ELSE 0 END)>0;

-- Which country has the highest number of comedy movies?
with country_genres as (SELECT nc.show_id, nc.country, ng.genre, n.type
from netflix_countries nc
         Inner Join netflix_genres ng on nc.show_id = ng.show_id
INNER JOIN netflix n on nc.show_id = n.show_id)

SELECT country, COUNT(*)
FROM country_genres
WHERE genre LIKE '%omed%' AND type = 'Movie'
GROUP BY country
ORDER BY COUNT(*) DESC
LIMIT 1;


-- For each year (per date added to netflix) who was the director with most movies released?

with directors_years as (
SELECT director, EXTRACT(YEAR FROM date_added) AS year, count(*) as num_of_films
FROM netflix n
INNER JOIN netflix_directors nd on nd.show_id=n.show_id
WHERE type='Movie'
GROUP BY EXTRACT(YEAR FROM date_added), director),

alsmo as (SELECT *, row_number() over (partition by year order by num_of_films desc) as rn
from directors_years)

SELECT * FROM alsmo where rn=1
order by year desc


-- What is the avg duration of movies in each genre?
with movie_durations as (
SELECT show_id, trim(durations[1]) as duration_min
from netflix
CROSS JOIN LATERAL string_to_array(duration, ' ') as durations
where type='Movie')

SELECT genre, round(AVG(duration_min::int)/60,2) as hours_duration
from netflix_genres ng
INNER JOIN movie_durations md ON ng.show_id=md.show_id
group by genre;


-- -find the list of directors who have created horror and comedy movies both.
-- display names of the directors with num of movies from each category.

select director,
       sum(case when genre = 'Comedies' then 1 ELSE 0 END) as comedies,
       sum(case when genre = 'Horror Movies' then 1 ELSE 0 END) as horror_movies
from netflix_directors nd
inner join netflix_genres ng on nd.show_id=ng.show_id
inner join public.netflix n on nd.show_id = n.show_id
where type='Movie' and genre in ('Comedies','Horror Movies')
group by director
having sum(case when genre = 'Comedies' then 1 ELSE 0 END) > 0
   AND sum(case when genre = 'Horror Movies' then 1 ELSE 0 END)>0
