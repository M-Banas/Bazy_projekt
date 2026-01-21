

CREATE SCHEMA main;


CREATE TABLE main.mecze (
	mecz_id int4 NOT NULL,
	"data" timestamp NULL,
	wersja varchar NULL,
	czas_gry varchar NULL,
	wygrana_czerwonych bool NULL,
	api_id varchar NULL,
	CONSTRAINT games_pkey PRIMARY KEY (mecz_id)
);




CREATE TABLE main.postaci (
	nazwa varchar NULL,
	postac_id int4 NOT NULL,
	CONSTRAINT postaci_pkey PRIMARY KEY (postac_id)
);




CREATE TABLE main.przedmioty (
	przedmiot_id int4 NOT NULL,
	nazwa_przedmiotu varchar NULL,
	CONSTRAINT przedmioty_pkey PRIMARY KEY (przedmiot_id)
);




CREATE TABLE main.użytkownicy (
	nazwa varchar NOT NULL,
	hasło varchar NULL,
	czy_admin bool NULL,
	CONSTRAINT użytkownicy_pkey PRIMARY KEY (nazwa)
);




CREATE TABLE main.uczestnicy_meczow (
	mecz_id int4 NOT NULL,
	postac_id int4 NULL,
	uczestnik_id int4 NOT NULL,
	czy_czerwoni bool NULL,
	CONSTRAINT uczestnicy_meczow_pkey PRIMARY KEY (uczestnik_id),
	CONSTRAINT uczestnicy_meczow_mecz_id_fkey FOREIGN KEY (mecz_id) REFERENCES main.mecze(mecz_id),
	CONSTRAINT uczestnicy_meczow_postac_id_fkey FOREIGN KEY (postac_id) REFERENCES main.postaci(postac_id)
);




CREATE TABLE main.uczestnicy_przedmioty (
	uczestnik_id int4 NULL,
	przedmiot_id int4 NULL,
	CONSTRAINT uczestnicy_przedmioty_przedmiot_id_fkey FOREIGN KEY (przedmiot_id) REFERENCES main.przedmioty(przedmiot_id),
	CONSTRAINT uczestnicy_przedmioty_uczestnik_id_fkey FOREIGN KEY (uczestnik_id) REFERENCES main.uczestnicy_meczow(uczestnik_id)
);




CREATE TABLE main.ulubione_postacie (
	użytkownik_nazwa text NOT NULL,
	postac_id int4 NOT NULL,
	CONSTRAINT ulubione_postacie_pkey PRIMARY KEY ("użytkownik_nazwa", postac_id),
	CONSTRAINT ulubione_postacie_postac_id_fkey FOREIGN KEY (postac_id) REFERENCES main.postaci(postac_id),
	CONSTRAINT ulubione_postacie_użytkownik_nazwa_fkey FOREIGN KEY (użytkownik_nazwa) REFERENCES main.użytkownicy(nazwa)
);




CREATE OR REPLACE VIEW main.v_patch_statystyka
AS SELECT wersja,
    count(*) AS mecze,
    sum(
        CASE
            WHEN wygrana_czerwonych = true THEN 1
            ELSE 0
        END) AS wygrane_czerwonych,
    round(sum(
        CASE
            WHEN wygrana_czerwonych = true THEN 1
            ELSE 0
        END)::numeric / NULLIF(count(*), 0)::numeric * 100::numeric, 2) AS procent_czerwonych,
    sum(
        CASE
            WHEN wygrana_czerwonych = false THEN 1
            ELSE 0
        END) AS wygrane_niebieskich,
    round(sum(
        CASE
            WHEN wygrana_czerwonych = false THEN 1
            ELSE 0
        END)::numeric / NULLIF(count(*), 0)::numeric * 100::numeric, 2) AS procent_niebieskich
   FROM main.mecze m
  GROUP BY wersja
  ORDER BY wersja DESC;



CREATE OR REPLACE VIEW main.v_top_przedmioty
AS SELECT p.postac_id,
    p.nazwa AS postac_nazwa,
    pr.przedmiot_id,
    pr.nazwa_przedmiotu,
    count(*) AS gry,
    sum(
        CASE
            WHEN um.czy_czerwoni = true AND m.wygrana_czerwonych = true OR um.czy_czerwoni = false AND m.wygrana_czerwonych = false THEN 1
            ELSE 0
        END) AS wygrane,
    round(sum(
        CASE
            WHEN um.czy_czerwoni = true AND m.wygrana_czerwonych = true OR um.czy_czerwoni = false AND m.wygrana_czerwonych = false THEN 1
            ELSE 0
        END)::numeric / count(*)::numeric * 100::numeric, 2) AS winrate
   FROM main.uczestnicy_przedmioty up
     JOIN main.uczestnicy_meczow um ON up.uczestnik_id = um.uczestnik_id
     JOIN main.mecze m ON um.mecz_id = m.mecz_id
     JOIN main.przedmioty pr ON up.przedmiot_id = pr.przedmiot_id
     JOIN main.postaci p ON um.postac_id = p.postac_id
  GROUP BY p.postac_id, p.nazwa, pr.przedmiot_id, pr.nazwa_przedmiotu
 HAVING count(*) >= 2;


-- main.v_winrate_postaci source

CREATE OR REPLACE VIEW main.v_winrate_postaci
AS SELECT p.postac_id,
    p.nazwa,
    count(*) AS gry,
    sum(
        CASE
            WHEN um.czy_czerwoni = true AND m.wygrana_czerwonych = true OR um.czy_czerwoni = false AND m.wygrana_czerwonych = false THEN 1
            ELSE 0
        END) AS wygrane,
    round(sum(
        CASE
            WHEN um.czy_czerwoni = true AND m.wygrana_czerwonych = true OR um.czy_czerwoni = false AND m.wygrana_czerwonych = false THEN 1
            ELSE 0
        END)::numeric / count(*)::numeric * 100::numeric, 2) AS winrate
   FROM main.uczestnicy_meczow um
     JOIN main.postaci p ON um.postac_id = p.postac_id
     JOIN main.mecze m ON um.mecz_id = m.mecz_id
  GROUP BY p.postac_id, p.nazwa;

  CREATE OR REPLACE FUNCTION main.set_default_match_date()
RETURNS TRIGGER AS $$
BEGIN
	IF NEW.data IS NULL THEN
		NEW.data = NOW();
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_default_match_date
	BEFORE INSERT ON main.mecze
	FOR EACH ROW
	EXECUTE FUNCTION main.set_default_match_date();

-- Trigger: Automatyczne generowanie postac_id jeśli nie został podany
CREATE OR REPLACE FUNCTION main.set_default_postac_id()
RETURNS TRIGGER AS $$
BEGIN
	IF NEW.postac_id IS NULL THEN
		NEW.postac_id = COALESCE((SELECT MAX(postac_id) FROM main.postaci), 0) + 1;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_default_postac_id
	BEFORE INSERT ON main.postaci
	FOR EACH ROW
	EXECUTE FUNCTION main.set_default_postac_id();