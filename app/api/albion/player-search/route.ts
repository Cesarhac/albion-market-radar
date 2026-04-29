import { NextResponse } from 'next/server';
import type { AlbionPlayerLookup } from '@/types/albion';

type AlbionSearchPlayer = {
  Id?: string;
  id?: string;
  Name?: string;
  name?: string;
  GuildName?: string;
  guildName?: string;
  AllianceName?: string;
  allianceName?: string;
};

type AlbionSearchResponse = {
  players?: AlbionSearchPlayer[];
};

const PLAYER_NOT_FOUND_WARNING =
  'Não encontramos esse personagem na busca pública do Albion. Você pode continuar, mas confira se digitou corretamente.';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerName = searchParams.get('name')?.trim() ?? '';

  if (!playerName) {
    return NextResponse.json(
      { found: false, warning: 'Informe o nome do personagem.' } satisfies AlbionPlayerLookup,
      { status: 400 },
    );
  }

  try {
    const url = new URL('https://gameinfo.albiononline.com/api/gameinfo/search');

    url.searchParams.set('q', playerName);

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({
        found: false,
        warning: 'A busca pública do Albion oscilou. Você pode continuar e validar o nome mais tarde.',
      } satisfies AlbionPlayerLookup);
    }

    const payload = (await response.json()) as AlbionSearchResponse;
    const players = Array.isArray(payload.players) ? payload.players : [];
    const player =
      players.find((candidate) => normalize(candidate.Name ?? candidate.name) === normalize(playerName)) ??
      players[0];

    if (!player) {
      return NextResponse.json({
        found: false,
        warning: PLAYER_NOT_FOUND_WARNING,
      } satisfies AlbionPlayerLookup);
    }

    return NextResponse.json({
      found: true,
      playerName: player.Name ?? player.name ?? playerName,
      playerId: player.Id ?? player.id,
      guildName: player.GuildName ?? player.guildName,
      allianceName: player.AllianceName ?? player.allianceName,
    } satisfies AlbionPlayerLookup);
  } catch {
    return NextResponse.json({
      found: false,
      warning: 'A busca pública do Albion oscilou. Você pode continuar e validar o nome mais tarde.',
    } satisfies AlbionPlayerLookup);
  }
}

function normalize(value: string | undefined) {
  return (value ?? '').trim().toLowerCase();
}
