export type StyleCategory = 'cinematic' | 'editorial' | 'street' | 'fashion' | 'anime' | 'realistic' | 'fantasy' | 'commercial' | 'ugc' | 'custom';

export interface Style {
  id: string;
  user_id: string | null;
  name: string;
  category: StyleCategory;
  description: string | null;
  prompt_template: string;
  negative_prompt: string | null;
  preview_asset_id: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharacterStyle {
  id: string;
  character_id: string;
  style_id: string;
  weight: number;
  is_primary: boolean;
  created_at: string;
  style?: Style;
}
