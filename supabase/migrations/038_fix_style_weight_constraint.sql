ALTER TABLE character_styles DROP CONSTRAINT IF EXISTS character_styles_weight_check;
ALTER TABLE character_styles ADD CONSTRAINT character_styles_weight_check CHECK (weight >= 0 AND weight <= 1.0);
UPDATE character_styles SET weight = 1.0 WHERE weight > 1.0;
