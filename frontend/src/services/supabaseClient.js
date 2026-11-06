import { createClient } from '@supabase/supabase-js';

/*
 * Supabase の接続先と公開キー（publishable key）。`.env.local` か Vercel の
 * 環境変数で与える。どちらかが欠けていれば接続しない（`supabase` は null）。
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * 共有の Supabase クライアントを作る。
 *
 * 接続情報が未設定の環境（ローカル開発・プレビューなど）でもゲームが
 * 止まらないよう、未設定なら null を返し、呼び出し側は何もしない。
 * ログインは使わないので、セッションの保存・自動更新は切っておく。
 *
 * Returns:
 *     SupabaseClient | null: 設定済みならクライアント、未設定なら null。
 */
function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const supabase = createSupabaseClient();

export default supabase;
