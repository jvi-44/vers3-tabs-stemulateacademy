// The avatar keys a student may pick (stored in users.avatar). Same list as
// AVATAR_KEYS in src/data/mock.ts — the server rejects anything else, so an
// avatar can never be an arbitrary URL. src/__tests__/server-mirror.test.ts
// fails if the two lists drift apart.
export const AVATAR_KEYS = [
  "boy_teal",
  "boy_blue",
  "girl_purple_bob",
  "girl_teal_buns",
  "boy_purple_spiky",
  "girl_pink_ponytail",
  "boy_teal_cap",
  "girl_teal_pigtails",
  "boy_yellow_curly",
  "girl_yellow_flower",
];
