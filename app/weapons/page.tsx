'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Coins,
  Copy,
  Edit3,
  Eye,
  Filter,
  ImagePlus,
  Info,
  Layers3,
  LayoutGrid,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Sword,
  Table2,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { ProGate } from '@/components/ProGate';
import { useAuth } from '@/context/AuthContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { ALBION_CITIES, MARKET_SERVER_REGIONS, QUALITIES } from '@/data/constants';
import {
  buildItemUniqueName,
  findCatalogItemsByQuery,
  getItemBaseDisplayName,
  normalizeSearchTerm,
} from '@/data/itemCatalog';
import {
  createWeapon4Listing,
  updateWeapon4Listing,
} from '@/lib/weapons4Storage';
import { formatEntitlementLimit, getUserEntitlements } from '@/src/lib/entitlements';
import {
  createWeaponListingInSupabase,
  deleteWeaponListingFromSupabase,
  fetchWeaponListingsFromSupabase,
  updateWeaponListingInSupabase,
} from '@/src/lib/supabase/database';
import { qualityIdsFromQuality, serverToParam } from '@/lib/marketData';
import {
  cn,
  formatCityName,
  formatDateTime,
  formatQuality,
  formatServerName,
  formatSilver,
  formatTierEnchant,
} from '@/lib/utils';
import { serverParamToRegion } from '@/lib/settingsStorage';
import type {
  AlbionCity,
  ItemCatalogEntry,
  ListingStatus,
  MarketPricesResponse,
  NewWeapon4Listing,
  Quality,
  ServerRegion,
  Tier,
  UserAccount,
  Weapon4Listing,
  Weapon4ListingType,
  Weapon4Trait,
  WeaponTraitRarity,
  WeaponUseCase,
} from '@/types/albion';

type TypeFilter = Weapon4ListingType | 'all';
type TierFilter = Tier | 'all';
type ServerFilter = ServerRegion | 'all';
type CityFilter = AlbionCity | 'all';
type QualityFilter = Quality | 'all';
type StatusFilter = ListingStatus | 'all';
type UseCaseFilter = WeaponUseCase | 'all';
type ListingsViewMode = 'cards' | 'table';

type EvaluationState =
  | { status: 'idle' | 'loading' | 'no-data' | 'error'; label: 'Sem dados suficientes' }
  | {
      status: 'ready';
      label: 'Barata' | 'Justa' | 'Cara';
      basePrice: number;
      difference: number;
      percent: number;
    };
type EvaluationReadyLabel = Extract<EvaluationState, { status: 'ready' }>['label'];

interface Weapon4FormState {
  weaponName: string;
  itemId: string;
  tier: Tier;
  quality: Quality;
  server: ServerRegion;
  city: AlbionCity;
  askingPrice: string;
  sellerUserId?: string;
  sellerPlayerName: string;
  sellerPlayerId?: string;
  sellerServer?: 'americas' | 'europe';
  sellerContact: string;
  discordUsername: string;
  discordUserId: string;
  discordInviteUrl: string;
  safetyAccepted: boolean;
  safetyAcceptedAt?: string;
  status: ListingStatus;
  description: string;
  useCases: WeaponUseCase[];
  screenshotsText: string;
  notes: string;
  isAwakened: boolean;
  awakenedLevel: string;
  itemPower: string;
  traits: WeaponTraitFormState[];
  traitTags: string;
  attunementPoints: string;
  estimatedInvestment: string;
  buildNotes: string;
}

interface WeaponTraitFormState {
  id: string;
  name: string;
  value: string;
  rarity: WeaponTraitRarity;
  notes: string;
}

const WEAPON_TIERS: Tier[] = [4, 5, 6, 7, 8];
const USE_CASES: WeaponUseCase[] = ['PvP', 'PvE', 'Mists', 'Gank', 'ZvZ', 'HCE'];
const TRAIT_RARITIES: WeaponTraitRarity[] = ['', 'Comum', 'Incomum', 'Raro', 'Épico', 'Lendário'];
const TRAIT_SUGGESTIONS = [
  'Poder de Item',
  'Dano de habilidade',
  'Redução de recarga',
  'Roubo de vida',
  'Vida máxima',
  'Defesa contra todos',
  'Velocidade de ataque',
  'Dano de ataque automático',
  'Alcance de ataque',
  'Cura realizada',
  'Energia máxima',
  'Resistência a controle de grupo',
] as const;

const emptyTrait = (): WeaponTraitFormState => ({
  id: `trait-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  value: '',
  rarity: '',
  notes: '',
});

const emptyForm: Weapon4FormState = {
  weaponName: '',
  itemId: '',
  tier: 6,
  quality: 'Excellent',
  server: 'Europe',
  city: 'Caerleon',
  askingPrice: '',
  sellerUserId: undefined,
  sellerPlayerName: '',
  sellerPlayerId: undefined,
  sellerServer: undefined,
  sellerContact: '',
  discordUsername: '',
  discordUserId: '',
  discordInviteUrl: '',
  safetyAccepted: false,
  safetyAcceptedAt: undefined,
  status: 'available',
  description: '',
  useCases: [],
  screenshotsText: '',
  notes: '',
  isAwakened: false,
  awakenedLevel: '',
  itemPower: '',
  traits: [emptyTrait()],
  traitTags: '',
  attunementPoints: '',
  estimatedInvestment: '',
  buildNotes: '',
};

function createEmptyForm(user?: UserAccount | null): Weapon4FormState {
  return {
    ...emptyForm,
    server: user ? serverParamToRegion(user.server) : emptyForm.server,
    sellerUserId: user?.id,
    sellerPlayerName: user?.playerName ?? '',
    sellerPlayerId: user?.playerId,
    sellerServer: user?.server,
    traits: [emptyTrait()],
  };
}

const statusLabel: Record<ListingStatus, string> = {
  available: 'Disponível',
  reserved: 'Reservado',
  sold: 'Vendido',
};

const typeLabel: Record<Weapon4ListingType, string> = {
  'standard-4': '.4 comum',
  awakened: 'Despertada',
};

const statusVariant = (status: ListingStatus): 'success' | 'warning' | 'danger' => {
  if (status === 'available') return 'success';
  if (status === 'reserved') return 'warning';
  return 'danger';
};

const typeVariant = (type: Weapon4ListingType): 'primary' | 'info' => {
  return type === 'awakened' ? 'info' : 'primary';
};

export default function WeaponsPage() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const router = useRouter();
  const entitlements = React.useMemo(() => getUserEntitlements(user), [user]);
  const isCompact = settings.interfaceDensity === 'compact';
  const isPro = entitlements.maxWeaponListings > 3;
  const [listings, setListings] = React.useState<Weapon4Listing[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Weapon4FormState>(() => createEmptyForm(user));
  const [selectedListing, setSelectedListing] = React.useState<Weapon4Listing | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all');
  const [tierFilter, setTierFilter] = React.useState<TierFilter>('all');
  const [serverFilter, setServerFilter] = React.useState<ServerFilter>('all');
  const [weaponFilter, setWeaponFilter] = React.useState('');
  const [qualityFilter, setQualityFilter] = React.useState<QualityFilter>('all');
  const [cityFilter, setCityFilter] = React.useState<CityFilter>('all');
  const [minPrice, setMinPrice] = React.useState('');
  const [maxPrice, setMaxPrice] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [useCaseFilter, setUseCaseFilter] = React.useState<UseCaseFilter>('all');
  const [listingsView, setListingsView] = React.useState<ListingsViewMode>('cards');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [formErrorMessage, setFormErrorMessage] = React.useState('');
  const userId = user?.id;

  React.useEffect(() => {
    let isActive = true;

    async function loadListings() {
      setIsLoaded(false);

      try {
        const nextListings = await fetchWeaponListingsFromSupabase();

        if (!isActive) return;
        setListings(nextListings);
      } catch (error) {
        if (!isActive) return;
        setFormErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar anúncios de Armas .4.');
        setListings([]);
      }

      if (!isActive) return;
      setIsLoaded(true);
    }

    void loadListings();

    return () => {
      isActive = false;
    };
  }, []);

  const activeUserListings = React.useMemo(
    () => listings.filter((listing) => listing.sellerUserId === userId && listing.status !== 'sold').length,
    [listings, userId],
  );
  const hasReachedListingLimit =
    Number.isFinite(entitlements.maxWeaponListings) && activeUserListings >= entitlements.maxWeaponListings;
  const isListingOwner = React.useCallback(
    (listing: Weapon4Listing) => Boolean(userId && listing.sellerUserId === userId),
    [userId],
  );

  const filteredListings = React.useMemo(() => {
    const query = normalizeSearchTerm(weaponFilter);
    const minimumPrice = Number(minPrice);
    const maximumPrice = Number(maxPrice);

    return listings
      .filter((listing) => {
        const searchText = normalizeSearchTerm(
          `${listing.weaponName} ${listing.itemId ?? ''} ${getListingSellerName(listing)} ${getListingSellerContact(listing)} ${(listing.traitTags ?? []).join(' ')}`,
        );
        const matchesWeapon = !query || searchText.includes(query);
        const matchesType = typeFilter === 'all' || listing.type === typeFilter;
        const matchesTier = tierFilter === 'all' || listing.tier === tierFilter;
        const matchesServer = serverFilter === 'all' || listing.server === serverFilter;
        const matchesQuality = qualityFilter === 'all' || listing.quality === qualityFilter;
        const matchesCity = cityFilter === 'all' || listing.city === cityFilter;
        const matchesStatus = statusFilter === 'all' || listing.status === statusFilter;
        const matchesUseCase = useCaseFilter === 'all' || listing.useCases.includes(useCaseFilter);
        const matchesMinimum = !Number.isFinite(minimumPrice) || minimumPrice <= 0 || listing.askingPrice >= minimumPrice;
        const matchesMaximum = !Number.isFinite(maximumPrice) || maximumPrice <= 0 || listing.askingPrice <= maximumPrice;

        return (
          matchesWeapon &&
          matchesType &&
          matchesTier &&
          matchesServer &&
          matchesQuality &&
          matchesCity &&
          matchesStatus &&
          matchesUseCase &&
          matchesMinimum &&
          matchesMaximum
        );
      })
      .sort((a, b) => {
        if (a.status !== b.status) return statusRank(a.status) - statusRank(b.status);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [
    cityFilter,
    listings,
    maxPrice,
    minPrice,
    qualityFilter,
    serverFilter,
    statusFilter,
    tierFilter,
    typeFilter,
    useCaseFilter,
    weaponFilter,
  ]);

  const openCreateForm = () => {
    if (!user) {
      router.push('/login?reason=auth-required&next=/weapons');
      return;
    }

    setEditingId(null);
    setForm(createEmptyForm(user));
    setIsFormOpen(true);
    setSuccessMessage('');
    setFormErrorMessage('');
  };

  const openEditForm = (listing: Weapon4Listing) => {
    if (!isListingOwner(listing)) {
      setFormErrorMessage('Apenas o criador do anúncio pode editar.');
      return;
    }

    setEditingId(listing.id);
    setForm(formFromListing(listing));
    setIsFormOpen(true);
    setSuccessMessage('');
    setFormErrorMessage('');
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(createEmptyForm(user));
    setFormErrorMessage('');
  };

  const handleSaveListing = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.safetyAccepted) {
      setFormErrorMessage('Você precisa aceitar o aviso de segurança para publicar o anúncio.');
      return;
    }

    const currentListing = editingId ? listings.find((listing) => listing.id === editingId) : undefined;

    if (currentListing && !isListingOwner(currentListing)) {
      setFormErrorMessage('Apenas o criador do anúncio pode editar.');
      return;
    }

    if (!currentListing && !user) {
      router.push('/login?reason=auth-required&next=/weapons');
      return;
    }

    if (!currentListing && hasReachedListingLimit) {
      setFormErrorMessage(
        `O plano Free permite até ${formatEntitlementLimit(entitlements.maxWeaponListings)} anúncios ativos de Armas .4. O plano PRO terá até 20 anúncios.`,
      );
      return;
    }

    const input = formToListingInput(form, user, currentListing);
    try {
      if (editingId && currentListing) {
        const nextListing = await updateWeaponListingInSupabase(updateWeapon4Listing(currentListing, input));
        const nextListings = listings.map((listing) => (listing.id === editingId ? nextListing : listing));

        setListings(nextListings);
        setSelectedListing((current) => (current?.id === editingId ? nextListing : current));
        setSuccessMessage('Anúncio atualizado.');
      } else {
        const nextListing = await createWeaponListingInSupabase(createWeapon4Listing(input));

        setListings([nextListing, ...listings]);
        setSuccessMessage('Arma .4 anunciada no Supabase.');
      }
    } catch (error) {
      setFormErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar o anúncio.');
      return;
    }
    closeForm();
  };

  const updateListingStatus = async (listingId: string, status: ListingStatus) => {
    const currentListing = listings.find((listing) => listing.id === listingId);

    if (!currentListing) return;
    if (!isListingOwner(currentListing)) {
      setFormErrorMessage('Apenas o criador do anúncio pode alterar o status.');
      return;
    }

    if (status === 'sold') {
      const confirmed = window.confirm('Tem certeza que deseja marcar esta arma como vendida? O anúncio será removido.');

      if (!confirmed) return;

      const previousListings = listings;
      const previousSelectedListing = selectedListing;
      setListings((current) => current.filter((listing) => listing.id !== listingId));
      setSelectedListing((current) => (current?.id === listingId ? null : current));

      try {
        await deleteWeaponListingFromSupabase(listingId, currentListing.sellerUserId ?? '');
      } catch (error) {
        setListings(previousListings);
        setSelectedListing(previousSelectedListing);
        setFormErrorMessage(error instanceof Error ? error.message : 'Não foi possível remover o anúncio vendido.');
        return;
      }

      setSuccessMessage('Anúncio removido com sucesso.');
      return;
    }

    try {
      const nextListing = await updateWeaponListingInSupabase({
        ...currentListing,
        status,
        updatedAt: new Date().toISOString(),
      });
      const nextListings = listings.map((listing) => (listing.id === listingId ? nextListing : listing));

      setListings(nextListings);
      setSelectedListing((current) => (current?.id === listingId ? nextListing : current));
    } catch (error) {
      setFormErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o status.');
    }
  };

  const deleteListing = async (listingId: string) => {
    const currentListing = listings.find((listing) => listing.id === listingId);

    if (!currentListing) return;
    if (!isListingOwner(currentListing)) {
      setFormErrorMessage('Apenas o criador do anúncio pode excluir.');
      return;
    }

    const confirmed = window.confirm('Tem certeza que deseja excluir este anúncio?');

    if (!confirmed) return;

    try {
      await deleteWeaponListingFromSupabase(listingId, currentListing.sellerUserId ?? '');
    } catch (error) {
      setFormErrorMessage(error instanceof Error ? error.message : 'Não foi possível excluir o anúncio.');
      return;
    }

    const nextListings = listings.filter((listing) => listing.id !== listingId);

    setListings(nextListings);
    setSelectedListing((current) => (current?.id === listingId ? null : current));
    setSuccessMessage('Anúncio excluído.');
  };

  const standardCount = listings.filter((listing) => listing.type === 'standard-4').length;
  const awakenedCount = listings.filter((listing) => listing.type === 'awakened').length;
  const availableCount = listings.filter((listing) => listing.status === 'available').length;

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_20%_0%,rgba(250,204,21,0.16),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_82%)] p-5 shadow-2xl md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Badge variant="primary" className="gap-2">
              <Sword size={13} />
              Apenas encantamento .4
            </Badge>
            <div>
              <h1 className="text-3xl font-black text-white md:text-5xl">Armas .4</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">
                Anuncie, encontre e compare armas .4 e armas despertadas vendidas por jogadores.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary"
          >
            <Plus size={17} />
            Anunciar arma .4
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <HeaderMetric icon={Sword} label=".4 comuns" value={standardCount} />
          <HeaderMetric icon={WandSparkles} label="Despertadas" value={awakenedCount} />
          <HeaderMetric icon={BadgeCheck} label="Disponíveis" value={availableCount} />
        </div>
      </header>

      {successMessage ? (
        <div className="flex items-start gap-3 rounded-lg border border-status-success/25 bg-status-success/10 p-4 text-status-success">
          <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
          <p className="text-sm font-bold">{successMessage}</p>
        </div>
      ) : null}

      <section className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="text-brand-primary" size={18} />
          <h2 className="font-black text-white">Filtros</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <SelectField label="Servidor">
            <select
              value={serverFilter}
              onChange={(event) => setServerFilter(event.target.value as ServerFilter)}
              className="field-control"
            >
              <option value="all">Todos</option>
              {MARKET_SERVER_REGIONS.map((server) => (
                <option key={server} value={server}>{formatServerName(server)}</option>
              ))}
            </select>
          </SelectField>

          <SelectField label="Tipo">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="field-control"
            >
              <option value="all">Todas</option>
              <option value="standard-4">.4 comum</option>
              <option value="awakened">Despertada</option>
            </select>
          </SelectField>

          <SelectField label="Tier">
            <select
              value={tierFilter}
              onChange={(event) => setTierFilter(event.target.value === 'all' ? 'all' : Number(event.target.value) as Tier)}
              className="field-control"
            >
              <option value="all">Todos</option>
              {WEAPON_TIERS.map((tier) => (
                <option key={tier} value={tier}>T{tier}</option>
              ))}
            </select>
          </SelectField>

          <label className="space-y-2">
            <span className="field-label">Arma</span>
            <input
              value={weaponFilter}
              onChange={(event) => setWeaponFilter(event.target.value)}
              placeholder="Dessangra, Bloodletter, Item ID"
              className="field-control"
            />
          </label>

          <SelectField label="Qualidade">
            <select
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value as QualityFilter)}
              className="field-control"
            >
              <option value="all">Todas</option>
              {QUALITIES.map((quality) => (
                <option key={quality} value={quality}>{formatQuality(quality)}</option>
              ))}
            </select>
          </SelectField>

          <SelectField label="Cidade">
            <select
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value as CityFilter)}
              className="field-control"
            >
              <option value="all">Todas</option>
              {ALBION_CITIES.map((city) => (
                <option key={city} value={city}>{formatCityName(city)}</option>
              ))}
            </select>
          </SelectField>

          <NumberFilter label="Preço mínimo" value={minPrice} onChange={setMinPrice} />
          <NumberFilter label="Preço máximo" value={maxPrice} onChange={setMaxPrice} />

          <SelectField label="Status">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="field-control"
            >
              <option value="all">Todos</option>
              <option value="available">Disponível</option>
              <option value="reserved">Reservado</option>
              <option value="sold">Vendido</option>
            </select>
          </SelectField>

          <SelectField label="Uso sugerido">
            <select
              value={useCaseFilter}
              onChange={(event) => setUseCaseFilter(event.target.value as UseCaseFilter)}
              className="field-control"
            >
              <option value="all">Todos</option>
              {USE_CASES.map((useCase) => (
                <option key={useCase} value={useCase}>{useCase}</option>
              ))}
            </select>
          </SelectField>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.56fr] xl:items-start">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Anúncios</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {isLoaded ? `${filteredListings.length} de ${listings.length} anúncios no Supabase` : 'Carregando anúncios no Supabase'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Supabase</Badge>
              <div className="inline-flex rounded-lg border border-border-subtle bg-zinc-950 p-1">
                <button
                  type="button"
                  onClick={() => setListingsView('cards')}
                  className={cn(
                    'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-black transition-colors',
                    listingsView === 'cards' ? 'bg-brand-primary text-bg-dark' : 'text-zinc-400 hover:text-white',
                  )}
                >
                  <LayoutGrid size={14} />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setListingsView('table')}
                  className={cn(
                    'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-black transition-colors',
                    listingsView === 'table' ? 'bg-brand-primary text-bg-dark' : 'text-zinc-400 hover:text-white',
                  )}
                >
                  <Table2 size={14} />
                  Tabela
                </button>
              </div>
            </div>
          </div>

          {hasReachedListingLimit ? (
            <ProGate
              title="Limite de anúncios Free"
              description={`Você atingiu ${formatEntitlementLimit(entitlements.maxWeaponListings)} anúncios ativos. O plano PRO terá até 20 anúncios de Armas .4.`}
            />
          ) : null}

          {filteredListings.length === 0 ? (
            <EmptyWeaponsState onCreate={openCreateForm} />
          ) : listingsView === 'table' ? (
            <WeaponListingsTable
              listings={filteredListings}
              isPro={isPro}
              userId={userId}
              onDetails={setSelectedListing}
              onEdit={openEditForm}
              onDelete={deleteListing}
              onStatusChange={updateListingStatus}
              onFeedback={setSuccessMessage}
            />
          ) : (
            <div className="grid gap-3">
              {filteredListings.map((listing) => (
                <WeaponCard
                  key={listing.id}
                  listing={listing}
                  canManage={isListingOwner(listing)}
                  isProSeller={isPro && isListingOwner(listing)}
                  compact={isCompact}
                  onDetails={setSelectedListing}
                  onEdit={openEditForm}
                  onDelete={deleteListing}
                  onStatusChange={updateListingStatus}
                  onFeedback={setSuccessMessage}
                />
              ))}
            </div>
          )}
        </div>

        <section className="space-y-4">
          <QuickEvaluationPanel form={form} />

          <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-brand-primary">
              <Info size={20} />
              Por que despertadas variam
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Armas despertadas podem valer mais que o preço base dependendo dos traits, poder de item,
              sintonia e uso. A comparação com a arma .4 comum é uma referência, não uma avaliação final.
            </p>
          </div>

          <MarketplaceResponsibilityNotice />
          <SecurityNotice />
        </section>
      </section>

      {isFormOpen ? (
        <WeaponFormModal
          form={form}
          editing={Boolean(editingId)}
          errorMessage={formErrorMessage}
          onChange={setForm}
          onClearError={() => setFormErrorMessage('')}
          onClose={closeForm}
          onSubmit={handleSaveListing}
        />
      ) : null}

      {selectedListing ? (
        <WeaponDetailsModal
          listing={selectedListing}
          canManage={isListingOwner(selectedListing)}
          onClose={() => setSelectedListing(null)}
          onEdit={openEditForm}
          onDelete={deleteListing}
          onStatusChange={updateListingStatus}
          onFeedback={setSuccessMessage}
        />
      ) : null}
    </div>
  );
}

function WeaponCard({
  listing,
  canManage,
  isProSeller,
  compact,
  onDetails,
  onEdit,
  onDelete,
  onStatusChange,
  onFeedback,
}: {
  listing: Weapon4Listing;
  canManage: boolean;
  isProSeller: boolean;
  compact: boolean;
  onDetails: (listing: Weapon4Listing) => void;
  onEdit: (listing: Weapon4Listing) => void;
  onDelete: (listingId: string) => void;
  onStatusChange: (listingId: string, status: ListingStatus) => void;
  onFeedback: (message: string) => void;
}) {
  return (
    <article className="grid overflow-hidden rounded-lg border border-border-subtle bg-bg-card shadow-xl transition-colors hover:border-brand-primary/35 lg:grid-cols-[180px_minmax(0,1fr)]">
      <WeaponVisual listing={listing} compact />

      <div className={cn('space-y-3', compact ? 'p-3' : 'p-4')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black text-white">
              {listing.weaponName} {formatTierEnchant(listing.tier, 4)}
            </h3>
            <p className="mt-1 break-all font-mono text-xs text-zinc-500">{listing.itemId || 'uniqueName não informado'}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Badge variant="primary">{formatTierEnchant(listing.tier, 4)}</Badge>
            <Badge variant={typeVariant(listing.type)}>{typeLabel[listing.type]}</Badge>
            <Badge variant={statusVariant(listing.status)}>{statusLabel[listing.status]}</Badge>
            <Badge variant="outline">{formatQuality(listing.quality)}</Badge>
            {listing.isAwakened ? <Badge variant="info">Despertada</Badge> : null}
            {isProSeller ? <Badge variant="primary">Anúncio PRO</Badge> : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <MiniMetric label="Servidor" value={formatServerName(listing.server)} />
          <MiniMetric label="Cidade" value={formatCityName(listing.city)} />
          <MiniMetric label="Preço pedido" value={formatSilver(listing.askingPrice)} tone="brand" />
          <MiniMetric label="Vendedor" value={getListingSellerName(listing)} />
          <div className="sm:col-span-2">
            <SellerContactActions listing={listing} onFeedback={onFeedback} />
          </div>
        </div>

        {!compact ? <p className="flex items-start gap-2 rounded-lg border border-status-warning/15 bg-status-warning/5 p-3 text-xs font-bold leading-relaxed text-status-warning">
          <ShieldAlert className="mt-0.5 shrink-0" size={14} />
          Negociação direta entre jogadores. Verifique tudo dentro do jogo.
        </p> : null}

        {listing.useCases.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {listing.useCases.map((useCase) => (
              <Badge key={useCase} variant="outline">{useCase}</Badge>
            ))}
          </div>
        ) : null}

        <WeaponTraitHighlights listing={listing} />

        <WeaponEvaluationSummary listing={listing} />

        <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={() => onDetails(listing)} className="secondary-button">
            <Eye size={15} />
            Ver detalhes
          </button>
          {canManage ? (
            <>
              <button type="button" onClick={() => onEdit(listing)} className="secondary-button">
                <Edit3 size={15} />
                Editar
              </button>
              <button
                type="button"
                onClick={() => onStatusChange(listing.id, 'reserved')}
                className="secondary-button"
                disabled={listing.status === 'reserved'}
              >
                Reservar
              </button>
              <button
                type="button"
                onClick={() => onStatusChange(listing.id, 'sold')}
                className="secondary-button"
                disabled={listing.status === 'sold'}
              >
                Marcar vendida
              </button>
              <button type="button" onClick={() => onDelete(listing.id)} className="danger-button">
                <Trash2 size={15} />
                Excluir
              </button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function WeaponListingsTable({
  listings,
  isPro,
  userId,
  onDetails,
  onEdit,
  onDelete,
  onStatusChange,
  onFeedback,
}: {
  listings: Weapon4Listing[];
  isPro: boolean;
  userId?: string;
  onDetails: (listing: Weapon4Listing) => void;
  onEdit: (listing: Weapon4Listing) => void;
  onDelete: (listingId: string) => void;
  onStatusChange: (listingId: string, status: ListingStatus) => void;
  onFeedback: (message: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-card shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] text-left text-sm">
          <thead className="border-b border-border-subtle bg-zinc-950 text-[11px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Traits principais</th>
              <th className="px-3 py-2">Preço</th>
              <th className="px-3 py-2">Cidade</th>
              <th className="px-3 py-2">Vendedor</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {listings.map((listing) => (
              <tr key={listing.id} className="align-top hover:bg-zinc-950/45">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border-subtle">
                      <WeaponVisual listing={listing} compact />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">{listing.weaponName}</p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-500">{listing.itemId || 'sem ID'}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="primary">{formatTierEnchant(listing.tier, 4)}</Badge>
                        <Badge variant={statusVariant(listing.status)}>{statusLabel[listing.status]}</Badge>
                        {isPro && listing.sellerUserId === userId ? <Badge variant="primary">PRO</Badge> : null}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="max-w-[260px] px-3 py-3">
                  <WeaponTraitHighlights listing={listing} compact />
                </td>
                <td className="px-3 py-3 font-black text-brand-primary">{formatSilver(listing.askingPrice)}</td>
                <td className="px-3 py-3 text-zinc-300">
                  <p>{formatCityName(listing.city)}</p>
                  <p className="text-xs text-zinc-500">{formatServerName(listing.server)}</p>
                </td>
                <td className="px-3 py-3 text-zinc-300">{getListingSellerName(listing)}</td>
                <td className="px-3 py-3">
                  <SellerContactActions listing={listing} onFeedback={onFeedback} compact />
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => onDetails(listing)} className="icon-button" aria-label="Ver detalhes">
                      <Eye size={14} />
                    </button>
                    {listing.sellerUserId === userId ? (
                      <>
                        <button type="button" onClick={() => onEdit(listing)} className="icon-button" aria-label="Editar">
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onStatusChange(listing.id, 'reserved')}
                          className="secondary-button h-8 px-2 text-xs"
                          disabled={listing.status === 'reserved'}
                        >
                          Reservar
                        </button>
                        <button
                          type="button"
                          onClick={() => onStatusChange(listing.id, 'sold')}
                          className="secondary-button h-8 px-2 text-xs"
                        >
                          Vendido
                        </button>
                        <button type="button" onClick={() => onDelete(listing.id)} className="danger-button h-8 px-2 text-xs">
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeaponTraitHighlights({ listing, compact = false, expanded = false }: { listing: Weapon4Listing; compact?: boolean; expanded?: boolean }) {
  const investedCost = getListingInvestedCost(listing);
  const visibleTraits = expanded ? listing.traits : listing.traits.slice(0, 2);
  const traitTags = listing.traitTags ?? [];
  const hasHighlights =
    listing.isAwakened ||
    Boolean(listing.itemPower || listing.attunementPoints || investedCost || listing.awakenedLevel) ||
    traitTags.length > 0 ||
    visibleTraits.length > 0;

  if (!hasHighlights) {
    return (
      <div className="rounded-lg border border-border-subtle bg-zinc-950 p-3 text-xs font-bold text-zinc-500">
        Sem traits destacados
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-status-info/20 bg-status-info/10 p-3', compact && 'p-2')}>
      <div className="flex flex-wrap gap-1.5">
        {listing.isAwakened ? <Badge variant="info">Despertada</Badge> : null}
        {listing.awakenedLevel ? <Badge variant="outline">Nível {listing.awakenedLevel}</Badge> : null}
        {listing.itemPower ? <Badge variant="primary">IP {listing.itemPower}</Badge> : null}
        {listing.attunementPoints ? <Badge variant="info">Sintonia {listing.attunementPoints}</Badge> : null}
        {investedCost ? <Badge variant="warning">Investido {formatSilver(investedCost)}</Badge> : null}
        {traitTags.slice(0, expanded ? undefined : 4).map((tag) => (
          <Badge key={tag} variant="outline">Trait {tag}</Badge>
        ))}
      </div>

      {visibleTraits.length > 0 ? (
        <div className="mt-2 grid gap-1.5">
          {visibleTraits.map((trait) => (
            <div key={trait.id} className="rounded-md border border-border-subtle bg-zinc-950/80 px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-xs font-black text-white">{trait.name || 'Trait'}</p>
                {trait.rarity ? <span className="text-[10px] font-bold uppercase text-status-info">{trait.rarity}</span> : null}
              </div>
              {trait.value ? <p className="mt-0.5 text-xs font-bold text-status-info">{trait.value}</p> : null}
              {expanded && trait.notes ? <p className="mt-1 text-xs text-zinc-500">{trait.notes}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function hasWeaponTraitHighlights(listing: Weapon4Listing): boolean {
  return (
    listing.isAwakened ||
    Boolean(listing.itemPower || listing.attunementPoints || getListingInvestedCost(listing) || listing.awakenedLevel) ||
    Boolean(listing.traitTags?.length) ||
    listing.traits.length > 0
  );
}

function SellerContactActions({
  listing,
  compact = false,
  onFeedback,
}: {
  listing: Pick<Weapon4Listing, 'sellerContact'>;
  compact?: boolean;
  onFeedback: (message: string) => void;
}) {
  const contact = listing.sellerContact?.trim();

  if (!contact) {
    return (
      <div className="rounded-lg bg-zinc-950 p-3 text-xs font-bold text-zinc-500">
        Contato não informado
      </div>
    );
  }

  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText(contact);
      onFeedback('Contato copiado.');
    } catch {
      onFeedback(`Contato do vendedor: ${contact}`);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2 rounded-lg bg-zinc-950 p-2', compact && 'p-1.5')}>
      <button type="button" onClick={copyContact} className="secondary-button h-8 px-2 text-xs">
        <Copy size={13} />
        Copiar contato
      </button>
    </div>
  );
}

function WeaponFormModal({
  form,
  editing,
  errorMessage,
  onChange,
  onClearError,
  onClose,
  onSubmit,
}: {
  form: Weapon4FormState;
  editing: boolean;
  errorMessage: string;
  onChange: React.Dispatch<React.SetStateAction<Weapon4FormState>>;
  onClearError: () => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const suggestions = React.useMemo(() => {
    if (form.weaponName.trim().length < 2) return [];

    return findCatalogItemsByQuery(
      form.weaponName,
      {
        category: 'Armas',
        tier: form.tier,
        enchantment: 4,
      },
      6,
    );
  }, [form.tier, form.weaponName]);

  const updateForm = <Key extends keyof Weapon4FormState>(key: Key, value: Weapon4FormState[Key]) => {
    onClearError();
    onChange((current) => ({ ...current, [key]: value }));
  };

  const selectWeapon = (item: ItemCatalogEntry) => {
    onClearError();
    onChange((current) => ({
      ...current,
      weaponName: getItemBaseDisplayName(item),
      itemId: buildItemUniqueName(item.uniqueName, current.tier, 4),
    }));
  };

  const updateTier = (tier: Tier) => {
    onClearError();
    onChange((current) => ({
      ...current,
      tier,
      itemId: current.itemId ? buildItemUniqueName(current.itemId, tier, 4) : resolveItemIdFromName(current.weaponName, tier),
    }));
  };

  const toggleUseCase = (useCase: WeaponUseCase) => {
    onClearError();
    onChange((current) => ({
      ...current,
      useCases: current.useCases.includes(useCase)
        ? current.useCases.filter((item) => item !== useCase)
        : [...current.useCases, useCase],
    }));
  };

  const updateTrait = <Key extends keyof WeaponTraitFormState>(
    traitId: string,
    key: Key,
    value: WeaponTraitFormState[Key],
  ) => {
    onClearError();
    onChange((current) => ({
      ...current,
      traits: current.traits.map((trait) => (trait.id === traitId ? { ...trait, [key]: value } : trait)),
    }));
  };

  const addTrait = () => {
    onClearError();
    onChange((current) => ({ ...current, traits: [...current.traits, emptyTrait()] }));
  };

  const removeTrait = (traitId: string) => {
    onClearError();
    onChange((current) => ({
      ...current,
      traits: current.traits.length > 1 ? current.traits.filter((trait) => trait.id !== traitId) : [emptyTrait()],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm md:items-center md:justify-center">
      <form
        onSubmit={onSubmit}
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border border-border-subtle bg-bg-card shadow-2xl md:max-w-6xl md:rounded-lg"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-bg-card/95 p-5 backdrop-blur">
          <div>
            <Badge variant="primary">Encantamento travado em .4</Badge>
            <h2 className="mt-2 text-2xl font-black text-white">
              {editing ? 'Editar anúncio .4' : 'Anunciar arma .4'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Fechar formulário">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 sm:col-span-2">
                  <span className="field-label">Nome da arma</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input
                      value={form.weaponName}
                      onChange={(event) => updateForm('weaponName', event.target.value)}
                      required
                      placeholder="Dessangra, Bloodletter, Mortíficos, Deathgivers..."
                      className="field-control pl-9"
                    />
                  </div>
                  {suggestions.length > 0 ? (
                    <div className="rounded-lg border border-border-subtle bg-zinc-950 p-2">
                      {suggestions.map((item) => (
                        <button
                          key={item.uniqueName}
                          type="button"
                          onClick={() => selectWeapon(item)}
                          className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white"
                        >
                          <span>{getItemBaseDisplayName(item)}</span>
                          <span className="font-mono text-xs text-zinc-500">{buildItemUniqueName(item.uniqueName, form.tier, 4)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>

                <label className="space-y-2">
                  <span className="field-label">Tier</span>
                  <select
                    value={form.tier}
                    onChange={(event) => updateTier(Number(event.target.value) as Tier)}
                    className="field-control"
                  >
                    {WEAPON_TIERS.map((tier) => (
                      <option key={tier} value={tier}>T{tier}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="field-label">Encantamento</span>
                  <input value=".4" readOnly className="field-control text-brand-primary" />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Qualidade</span>
                  <select
                    value={form.quality}
                    onChange={(event) => updateForm('quality', event.target.value as Quality)}
                    className="field-control"
                  >
                    {QUALITIES.map((quality) => (
                      <option key={quality} value={quality}>{formatQuality(quality)}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="field-label">Servidor</span>
                  <select
                    value={form.server}
                    onChange={(event) => updateForm('server', event.target.value as ServerRegion)}
                    className="field-control"
                  >
                    {MARKET_SERVER_REGIONS.map((server) => (
                      <option key={server} value={server}>{formatServerName(server)}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="field-label">Cidade</span>
                  <select
                    value={form.city}
                    onChange={(event) => updateForm('city', event.target.value as AlbionCity)}
                    className="field-control"
                  >
                    {ALBION_CITIES.map((city) => (
                      <option key={city} value={city}>{formatCityName(city)}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="field-label">Preço pedido em prata</span>
                  <input
                    type="number"
                    min={1}
                    value={form.askingPrice}
                    onChange={(event) => updateForm('askingPrice', event.target.value)}
                    required
                    placeholder="18500000"
                    className="field-control"
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Vendedor</span>
                  <input
                    value={form.sellerPlayerName || 'Player logado'}
                    readOnly
                    className="field-control cursor-not-allowed text-brand-primary"
                  />
                  <span className="block text-xs leading-relaxed text-zinc-500">
                    O vendedor vem da conta logada e não pode ser alterado no anúncio.
                  </span>
                </label>

                <label className="space-y-2">
                  <span className="field-label">Contato do vendedor (opcional)</span>
                  <input
                    value={form.sellerContact}
                    onChange={(event) => updateForm('sellerContact', event.target.value)}
                    placeholder="Nick do Albion ou observação de contato"
                    className="field-control"
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => updateForm('status', event.target.value as ListingStatus)}
                    className="field-control"
                  >
                    <option value="available">Disponível</option>
                    <option value="reserved">Reservado</option>
                  </select>
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="field-label">Item ID / uniqueName</span>
                  <input
                    value={form.itemId}
                    onChange={(event) => updateForm('itemId', forceEnchantment4(event.target.value, form.tier))}
                    placeholder="Gerado ao selecionar arma, ou informe manualmente"
                    className="field-control font-mono"
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="field-label">Descrição</span>
                  <textarea
                    value={form.description}
                    onChange={(event) => updateForm('description', event.target.value)}
                    rows={3}
                    placeholder="Condição da negociação, horário, observações de entrega..."
                    className="field-textarea"
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="field-label">Prints da arma</span>
                  <textarea
                    value={form.screenshotsText}
                    onChange={(event) => updateForm('screenshotsText', event.target.value)}
                    rows={2}
                    placeholder="Cole um link por linha"
                    className="field-textarea"
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="field-label">Observações</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateForm('notes', event.target.value)}
                    rows={2}
                    className="field-textarea"
                  />
                </label>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-lg border border-border-subtle bg-zinc-950 p-4">
                <h3 className="font-black text-white">Uso sugerido</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {USE_CASES.map((useCase) => (
                    <label key={useCase} className="flex cursor-pointer items-center gap-2 rounded-md border border-border-subtle bg-bg-card px-3 py-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={form.useCases.includes(useCase)}
                        onChange={() => toggleUseCase(useCase)}
                        className="accent-brand-primary"
                      />
                      {useCase}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-4">
                <input
                  type="checkbox"
                  checked={form.isAwakened}
                  onChange={(event) => updateForm('isAwakened', event.target.checked)}
                  className="mt-1 h-4 w-4 accent-brand-primary"
                />
                <span>
                  <span className="block font-black text-white">Esta arma é despertada?</span>
                  <span className="mt-1 block text-sm leading-relaxed text-zinc-400">
                    Ative para registrar traits, sintonia e investimento.
                  </span>
                </span>
              </label>

              <QuickEvaluationPanel form={form} compact />
            </aside>
          </section>

          {form.isAwakened ? (
            <section className="rounded-lg border border-status-info/20 bg-status-info/10 p-4">
              <h3 className="flex items-center gap-2 font-black text-white">
                <WandSparkles className="text-status-info" size={18} />
                Dados da arma despertada
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-2">
                  <span className="field-label">Poder de Item atual</span>
                  <input
                    value={form.itemPower}
                    onChange={(event) => updateForm('itemPower', event.target.value)}
                    placeholder="Ex.: 1512"
                    className="field-control"
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Pontos de sintonia</span>
                  <input
                    value={form.attunementPoints}
                    onChange={(event) => updateForm('attunementPoints', event.target.value)}
                    placeholder="Se souber"
                    className="field-control"
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Nível despertada</span>
                  <input
                    type="number"
                    min={0}
                    value={form.awakenedLevel}
                    onChange={(event) => updateForm('awakenedLevel', event.target.value)}
                    placeholder="Opcional"
                    className="field-control"
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Custo investido estimado</span>
                  <input
                    type="number"
                    min={0}
                    value={form.estimatedInvestment}
                    onChange={(event) => updateForm('estimatedInvestment', event.target.value)}
                    className="field-control"
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Tags adicionais</span>
                  <input
                    value={form.traitTags}
                    onChange={(event) => updateForm('traitTags', event.target.value)}
                    placeholder="PVP, Gank, Mists"
                    className="field-control"
                  />
                </label>

                <label className="space-y-2">
                  <span className="field-label">Build / uso</span>
                  <input
                    value={form.buildNotes}
                    onChange={(event) => updateForm('buildNotes', event.target.value)}
                    placeholder="Mists, PvP solo, ZvZ..."
                    className="field-control"
                  />
                </label>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-black text-white">Traits / atributos</h4>
                  <button type="button" onClick={addTrait} className="secondary-button">
                    <Plus size={15} />
                    Trait
                  </button>
                </div>

                {form.traits.map((trait) => (
                  <div key={trait.id} className="grid gap-3 rounded-lg border border-border-subtle bg-zinc-950 p-3 md:grid-cols-[1fr_0.8fr_0.7fr_1fr_auto]">
                    <label className="space-y-2">
                      <span className="field-label">Nome do trait</span>
                      <input
                        list="trait-suggestions"
                        value={trait.name}
                        onChange={(event) => updateTrait(trait.id, 'name', event.target.value)}
                        placeholder="Dano de habilidade"
                        className="field-control"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="field-label">Valor</span>
                      <input
                        value={trait.value}
                        onChange={(event) => updateTrait(trait.id, 'value', event.target.value)}
                        placeholder="+8,2%"
                        className="field-control"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="field-label">Raridade</span>
                      <select
                        value={trait.rarity}
                        onChange={(event) => updateTrait(trait.id, 'rarity', event.target.value as WeaponTraitRarity)}
                        className="field-control"
                      >
                        {TRAIT_RARITIES.map((rarity) => (
                          <option key={rarity || 'none'} value={rarity}>{rarity || 'Não sei'}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="field-label">Observação</span>
                      <input
                        value={trait.notes}
                        onChange={(event) => updateTrait(trait.id, 'notes', event.target.value)}
                        className="field-control"
                      />
                    </label>
                    <button type="button" onClick={() => removeTrait(trait.id)} className="icon-button self-end" aria-label="Remover trait">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <datalist id="trait-suggestions">
                  {TRAIT_SUGGESTIONS.map((trait) => (
                    <option key={trait} value={trait} />
                  ))}
                </datalist>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 shrink-0 text-status-warning" size={20} />
              <div>
                <h3 className="font-black text-white">Aviso de segurança</h3>
                <p className="mt-2 text-sm leading-relaxed text-status-warning">
                  O Albion Market Radar apenas divulga anúncios criados por jogadores. O site não
                  intermedia negociações, pagamentos, trocas, entregas de itens ou transferência de
                  prata. Toda negociação é feita por conta e risco dos jogadores envolvidos.
                </p>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-status-warning/25 bg-zinc-950/70 p-3">
              <input
                type="checkbox"
                checked={form.safetyAccepted}
                onChange={(event) => updateForm('safetyAccepted', event.target.checked)}
                className="mt-1 h-4 w-4 accent-status-warning"
              />
              <span className="text-sm font-bold leading-relaxed text-zinc-200">
                Entendo que o Albion Market Radar não é responsável por golpes, fraudes, perdas de
                itens, perdas de prata ou negociações realizadas fora do site.
              </span>
            </label>

            {errorMessage ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-status-danger/25 bg-status-danger/10 p-3 text-sm font-bold text-status-danger">
                <AlertTriangle className="mt-0.5 shrink-0" size={17} />
                {errorMessage}
              </div>
            ) : null}
          </section>

          <div className="flex flex-col gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="secondary-button justify-center">
              Cancelar
            </button>
            <button type="submit" className="primary-button justify-center">
              <Plus size={17} />
              {editing ? 'Salvar alterações' : 'Publicar anúncio'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function WeaponDetailsModal({
  listing,
  canManage,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onFeedback,
}: {
  listing: Weapon4Listing;
  canManage: boolean;
  onClose: () => void;
  onEdit: (listing: Weapon4Listing) => void;
  onDelete: (listingId: string) => void;
  onStatusChange: (listingId: string, status: ListingStatus) => void;
  onFeedback: (message: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm md:items-center md:justify-center">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border border-border-subtle bg-bg-card shadow-2xl md:max-w-5xl md:rounded-lg">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-bg-card/95 p-5 backdrop-blur">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={typeVariant(listing.type)}>{typeLabel[listing.type]}</Badge>
              <Badge variant={statusVariant(listing.status)}>{statusLabel[listing.status]}</Badge>
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">
              {listing.weaponName} {formatTierEnchant(listing.tier, 4)}
            </h2>
            <p className="mt-1 break-all font-mono text-xs text-zinc-500">{listing.itemId || 'uniqueName não informado'}</p>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Fechar detalhes">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <MiniMetric label="Preço pedido" value={formatSilver(listing.askingPrice)} tone="brand" />
            <MiniMetric label="Qualidade" value={formatQuality(listing.quality)} />
            <MiniMetric label="Servidor" value={formatServerName(listing.server)} />
            <MiniMetric label="Cidade" value={formatCityName(listing.city)} />
            <MiniMetric label="Vendedor" value={getListingSellerName(listing)} />
            <div className="md:col-span-2">
              <SellerContactActions listing={listing} onFeedback={onFeedback} />
            </div>
            <MiniMetric label="Criado" value={formatDateTime(listing.createdAt)} />
            <MiniMetric label="Atualizado" value={<RelativeTime date={listing.updatedAt} />} />
          </div>

          <WeaponEvaluationSummary listing={listing} expanded />

          <section className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-4">
            <h3 className="flex items-center gap-2 font-black text-white">
              <ShieldAlert className="text-status-warning" size={18} />
              Segurança da negociação
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-status-warning">
              O Albion Market Radar não participa da negociação e não garante entrega, pagamento,
              preço ou autenticidade do anúncio. Confirme os dados dentro do jogo antes de negociar.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MiniMetric label="Vendedor" value={getListingSellerName(listing)} />
              <div className="md:col-span-2">
                <SellerContactActions listing={listing} onFeedback={onFeedback} />
              </div>
              <MiniMetric label="Servidor" value={formatServerName(listing.server)} />
              <MiniMetric label="Cidade" value={formatCityName(listing.city)} />
              <MiniMetric label="Status" value={statusLabel[listing.status]} />
              <MiniMetric label="Data do anúncio" value={formatDateTime(listing.createdAt)} />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <InfoPanel title="Informações gerais">
              <p>Tipo: {typeLabel[listing.type]}</p>
              <p>Status: {statusLabel[listing.status]}</p>
              <p>Uso sugerido: {listing.useCases.length ? listing.useCases.join(', ') : 'Não informado'}</p>
              {listing.description ? <p>Descrição: {listing.description}</p> : null}
              {listing.notes ? <p>Observações: {listing.notes}</p> : null}
            </InfoPanel>

            <InfoPanel title="Prints">
              {listing.screenshots.length > 0 ? (
                <div className="space-y-2">
                  {listing.screenshots.map((screenshot, index) => (
                    <a
                      key={screenshot}
                      href={screenshot}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-status-info hover:text-white"
                    >
                      <ImagePlus size={15} />
                      Print {index + 1}
                    </a>
                  ))}
                </div>
              ) : (
                <p>Nenhum print informado.</p>
              )}
            </InfoPanel>
          </section>

          {hasWeaponTraitHighlights(listing) ? (
            <section className="rounded-lg border border-status-info/20 bg-status-info/10 p-4">
              <h3 className="flex items-center gap-2 font-black text-white">
                <WandSparkles className="text-status-info" size={18} />
                Traits detalhados
              </h3>
              <div className="mt-4">
                <WeaponTraitHighlights listing={listing} expanded />
              </div>
              {listing.buildNotes ? <p className="mt-4 text-sm text-zinc-300">{listing.buildNotes}</p> : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {listing.traits.length > 0 ? (
                  listing.traits.map((trait) => (
                    <div key={trait.id} className="rounded-lg border border-border-subtle bg-zinc-950 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-black text-white">{trait.name}</p>
                        {trait.rarity ? <Badge variant="outline">{trait.rarity}</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm font-bold text-status-info">{trait.value}</p>
                      {trait.notes ? <p className="mt-2 text-sm text-zinc-500">{trait.notes}</p> : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-zinc-400">Nenhum trait informado.</p>
                )}
              </div>
            </section>
          ) : null}

          <SecurityNotice />

          {canManage ? (
            <div className="flex flex-col gap-2 border-t border-border-subtle pt-5 sm:flex-row sm:flex-wrap sm:justify-end">
              <button type="button" onClick={() => onEdit(listing)} className="secondary-button justify-center">
                <Edit3 size={15} />
                Editar
              </button>
              <button
                type="button"
                onClick={() => onStatusChange(listing.id, 'reserved')}
                className="secondary-button justify-center"
                disabled={listing.status === 'reserved'}
              >
                Reservar
              </button>
              <button
                type="button"
                onClick={() => onStatusChange(listing.id, 'sold')}
                className="secondary-button justify-center"
                disabled={listing.status === 'sold'}
              >
                Marcar vendida
              </button>
              <button type="button" onClick={() => onDelete(listing.id)} className="danger-button justify-center">
                <Trash2 size={15} />
                Excluir
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QuickEvaluationPanel({ form, compact = false }: { form: Weapon4FormState; compact?: boolean }) {
  const listing = React.useMemo(() => {
    if (!form.weaponName || !form.askingPrice) return null;

    return createPreviewListing(form);
  }, [form]);

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl">
      <h2 className="flex items-center gap-2 text-lg font-black text-white">
        <BarChart3 className="text-brand-primary" size={20} />
        Avaliação rápida
      </h2>
      {listing ? (
        <div className="mt-4">
          <WeaponEvaluationSummary listing={listing} expanded={!compact} />
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Selecione uma arma .4 e informe um preço pedido para comparar com o menor preço de venda atual da arma .4 comum.
        </p>
      )}
    </div>
  );
}

function WeaponEvaluationSummary({ listing, expanded = false }: { listing: Weapon4Listing; expanded?: boolean }) {
  const evaluation = useWeaponEvaluation(listing);

  if (evaluation.status === 'loading') {
    return (
      <div className="rounded-lg border border-border-subtle bg-zinc-950 p-3 text-sm text-zinc-400">
        Consultando preço base da arma .4 comum...
      </div>
    );
  }

  if (evaluation.status !== 'ready') {
    return (
      <div className="rounded-lg border border-border-subtle bg-zinc-950 p-3 text-sm text-zinc-400">
        <p className="font-bold text-white">Avaliação rápida: Sem dados suficientes</p>
        <p className="mt-1">Informe um uniqueName válido ou tente novamente quando a API tiver preço base.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-zinc-950 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Avaliação rápida</p>
          <p className={cn('mt-1 text-lg font-black', evaluationTone(evaluation.label))}>{evaluation.label}</p>
        </div>
        <Badge variant={evaluationBadgeVariant(evaluation.label)}>{formatSignedPercent(evaluation.percent)}</Badge>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="Preço pedido" value={formatSilver(listing.askingPrice)} tone="brand" />
        <MiniMetric label="Preço base estimado" value={formatSilver(evaluation.basePrice)} />
        <MiniMetric label="Diferença" value={formatSignedSilver(evaluation.difference)} tone={evaluation.difference > 0 ? 'danger' : 'success'} />
      </div>

      {expanded && listing.isAwakened ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Armas despertadas podem valer mais que o preço base dependendo dos traits. Use a comparação apenas como referência.
        </p>
      ) : null}
    </div>
  );
}

function useWeaponEvaluation(listing: Weapon4Listing): EvaluationState {
  const [evaluation, setEvaluation] = React.useState<EvaluationState>({
    status: 'idle',
    label: 'Sem dados suficientes',
  });

  React.useEffect(() => {
    let isActive = true;

    if (!listing.itemId || listing.askingPrice <= 0) {
      queueMicrotask(() => {
        if (isActive) setEvaluation({ status: 'no-data', label: 'Sem dados suficientes' });
      });

      return () => {
        isActive = false;
      };
    }

    const controller = new AbortController();
    const qualityIds = qualityIdsFromQuality(listing.quality, 'Normal');
    const params = new URLSearchParams({
      itemId: listing.itemId,
      server: serverToParam(listing.server),
      qualities: qualityIds.join(','),
    });

    queueMicrotask(() => {
      if (isActive) setEvaluation({ status: 'loading', label: 'Sem dados suficientes' });
    });

    fetch(`/api/market/prices?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('market-price-failed');
        return response.json() as Promise<MarketPricesResponse>;
      })
      .then((payload) => {
        const sellPrices = payload.data
          .map((price) => price.sellPriceMin)
          .filter((price) => Number.isFinite(price) && price > 0);
        const basePrice = Math.min(...sellPrices);

        if (!isActive) return;

        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          setEvaluation({ status: 'no-data', label: 'Sem dados suficientes' });
          return;
        }

        const difference = listing.askingPrice - basePrice;
        const percent = (difference / basePrice) * 100;

        setEvaluation({
          status: 'ready',
          label: classifyEvaluation(percent),
          basePrice,
          difference,
          percent,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (isActive) setEvaluation({ status: 'error', label: 'Sem dados suficientes' });
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [listing.askingPrice, listing.itemId, listing.quality, listing.server]);

  return evaluation;
}

function HeaderMetric({ icon: Icon, label, value }: { icon: typeof Sword; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-zinc-950/70 p-4">
      <div className="flex items-center gap-3">
        <span className="rounded-md border border-brand-primary/20 bg-brand-primary/10 p-2 text-brand-primary">
          <Icon size={18} />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="text-2xl font-black text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function WeaponVisual({ listing, compact = false }: { listing: Weapon4Listing; compact?: boolean }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden border-border-subtle bg-[radial-gradient(circle_at_32%_24%,rgba(250,204,21,0.24),transparent_30%),radial-gradient(circle_at_70%_78%,rgba(56,189,248,0.13),transparent_34%),linear-gradient(135deg,#09090b,#18181b)]',
        compact ? 'h-full min-h-28 w-full border-b lg:min-h-full lg:border-b-0 lg:border-r' : 'aspect-[16/9] border-b',
      )}
    >
      <Sword className="text-brand-primary/85" size={compact ? 44 : 76} />
      {listing.isAwakened ? <Sparkles className={cn('absolute text-status-info', compact ? 'right-3 top-3' : 'right-5 top-5')} size={compact ? 16 : 22} /> : null}
      <div className={cn('absolute rounded-md border border-brand-primary/25 bg-bg-dark/85 px-2 py-1 font-black text-brand-primary', compact ? 'left-3 top-3 text-[11px]' : 'left-4 top-4 text-xs')}>
        {formatTierEnchant(listing.tier, 4)}
      </div>
      <div className={cn('absolute rounded-md border border-border-subtle bg-bg-dark/85 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400', compact ? 'bottom-3 right-3' : 'bottom-4 right-4')}>
        {listing.isAwakened ? 'Despertada' : '.4 comum'}
      </div>
    </div>
  );
}

function EmptyWeaponsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border-subtle bg-bg-card p-8 text-center">
      <Sword className="mx-auto text-brand-primary" size={36} />
      <h2 className="mt-3 text-xl font-black text-white">Nenhuma arma .4 encontrada</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500">
        Cadastre uma arma .4 comum ou despertada para começar a comparar preço, traits e status.
      </p>
      <button type="button" onClick={onCreate} className="primary-button mx-auto mt-5">
        <Plus size={17} />
        Anunciar arma .4
      </button>
    </div>
  );
}

function MarketplaceResponsibilityNotice() {
  return (
    <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-5 text-sm leading-relaxed text-status-warning">
      <h2 className="flex items-center gap-2 text-lg font-black text-white">
        <ShieldAlert className="text-status-warning" size={20} />
        Responsabilidade nas negociações
      </h2>
      <p className="mt-3">
        O Albion Market Radar apenas fornece ferramentas, dados e divulgação de anúncios. O site não
        vende prata, não vende itens por dinheiro real, não vende contas, não intermedia pagamentos
        e não garante negociações entre jogadores.
      </p>
      <p className="mt-2">
        Usuários são responsáveis por verificar todas as informações dentro do jogo. Toda negociação
        deve seguir as regras do Albion Online e é feita por conta e risco dos jogadores envolvidos.
      </p>
    </div>
  );
}

function SecurityNotice() {
  return (
    <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-4 text-sm leading-relaxed text-status-warning">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 shrink-0" size={19} />
        <p>
          O Albion Market Radar não intermedia pagamentos, não vende prata e não participa de negociações por dinheiro real.
          Os anúncios são informativos e devem seguir as regras do jogo.
        </p>
      </div>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-zinc-950 p-4">
      <h3 className="font-black text-white">{title}</h3>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

function SelectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function NumberFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="field-label">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-control"
      />
    </label>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'brand' | 'success' | 'danger';
}) {
  return (
    <div className="min-w-0 rounded-lg bg-zinc-950 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-1 truncate font-black text-white',
          tone === 'brand' && 'text-brand-primary',
          tone === 'success' && 'text-status-success',
          tone === 'danger' && 'text-status-danger',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function formToListingInput(
  form: Weapon4FormState,
  user: UserAccount | null,
  currentListing?: Weapon4Listing,
): NewWeapon4Listing {
  const itemId = form.itemId.trim() || resolveItemIdFromName(form.weaponName, form.tier);
  const isAwakened = form.isAwakened;
  const sellerPlayerName =
    currentListing?.sellerPlayerName ??
    currentListing?.sellerName ??
    user?.playerName ??
    form.sellerPlayerName;
  const safetyAcceptedAt = currentListing?.safetyAcceptedAt ?? form.safetyAcceptedAt ?? new Date().toISOString();
  const sellerContact = form.sellerContact.trim() || undefined;
  const investedCost = isAwakened ? parseOptionalSilver(form.estimatedInvestment) : undefined;

  return {
    weaponName: form.weaponName.trim(),
    itemId: itemId || undefined,
    tier: form.tier,
    enchantment: 4,
    quality: form.quality,
    server: form.server,
    city: form.city,
    askingPrice: Number(form.askingPrice),
    sellerName: sellerPlayerName,
    sellerUserId: currentListing?.sellerUserId ?? user?.id ?? form.sellerUserId,
    sellerPlayerName,
    sellerPlayerId: currentListing?.sellerPlayerId ?? user?.playerId ?? form.sellerPlayerId,
    sellerServer: currentListing?.sellerServer ?? user?.server ?? form.sellerServer,
    sellerContact,
    discordUsername: undefined,
    discordUserId: undefined,
    discordInviteUrl: undefined,
    safetyAcceptedAt,
    status: form.status,
    description: form.description.trim() || undefined,
    useCases: form.useCases,
    screenshots: parseScreenshots(form.screenshotsText),
    notes: form.notes.trim() || undefined,
    isAwakened,
    awakened: isAwakened,
    awakenedLevel: isAwakened ? parseOptionalInteger(form.awakenedLevel) : undefined,
    itemPower: isAwakened ? form.itemPower.trim() || undefined : undefined,
    traits: isAwakened ? parseTraits(form.traits) : [],
    traitTags: isAwakened ? parseTags(form.traitTags) : [],
    attunementPoints: isAwakened ? form.attunementPoints.trim() || undefined : undefined,
    investedCost,
    estimatedInvestment: investedCost,
    buildNotes: isAwakened ? form.buildNotes.trim() || undefined : undefined,
  };
}

function formFromListing(listing: Weapon4Listing): Weapon4FormState {
  return {
    weaponName: listing.weaponName,
    itemId: listing.itemId ?? '',
    tier: listing.tier,
    quality: listing.quality,
    server: listing.server,
    city: listing.city,
    askingPrice: String(listing.askingPrice),
    sellerUserId: listing.sellerUserId,
    sellerPlayerName: getListingSellerName(listing),
    sellerPlayerId: listing.sellerPlayerId,
    sellerServer: listing.sellerServer,
    sellerContact: listing.sellerContact ?? '',
    discordUsername: '',
    discordUserId: '',
    discordInviteUrl: '',
    safetyAccepted: Boolean(listing.safetyAcceptedAt),
    safetyAcceptedAt: listing.safetyAcceptedAt,
    status: listing.status,
    description: listing.description ?? '',
    useCases: listing.useCases,
    screenshotsText: listing.screenshots.join('\n'),
    notes: listing.notes ?? '',
    isAwakened: listing.isAwakened,
    awakenedLevel: listing.awakenedLevel ? String(listing.awakenedLevel) : '',
    itemPower: listing.itemPower ?? '',
    traits: listing.traits.length > 0 ? listing.traits.map(traitToForm) : [emptyTrait()],
    traitTags: listing.traitTags?.join(', ') ?? '',
    attunementPoints: listing.attunementPoints ?? '',
    estimatedInvestment: getListingInvestedCost(listing) ? String(getListingInvestedCost(listing)) : '',
    buildNotes: listing.buildNotes ?? '',
  };
}

function createPreviewListing(form: Weapon4FormState): Weapon4Listing {
  return createWeapon4Listing(formToListingInput(form, null));
}

function traitToForm(trait: Weapon4Trait): WeaponTraitFormState {
  return {
    id: trait.id,
    name: trait.name,
    value: trait.value,
    rarity: trait.rarity ?? '',
    notes: trait.notes ?? '',
  };
}

function parseTraits(traits: WeaponTraitFormState[]): Weapon4Trait[] {
  return traits
    .map((trait) => ({
      id: trait.id,
      name: trait.name.trim(),
      value: trait.value.trim(),
      rarity: trait.rarity,
      notes: trait.notes.trim() || undefined,
    }))
    .filter((trait) => trait.name || trait.value);
}

function parseScreenshots(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalSilver(value: string): number | undefined {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function parseOptionalInteger(value: string): number | undefined {
  const numeric = Number(value);

  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined;
}

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function resolveItemIdFromName(weaponName: string, tier: Tier): string {
  const item = findCatalogItemsByQuery(
    weaponName,
    {
      category: 'Armas',
      tier,
      enchantment: 4,
    },
    1,
  )[0];

  return item ? buildItemUniqueName(item.uniqueName, tier, 4) : '';
}

function forceEnchantment4(value: string, tier: Tier): string {
  if (!value.trim()) return '';

  return buildItemUniqueName(value, tier, 4);
}

function classifyEvaluation(percent: number): EvaluationReadyLabel {
  if (percent <= -10) return 'Barata';
  if (percent <= 25) return 'Justa';
  return 'Cara';
}

function evaluationTone(label: 'Barata' | 'Justa' | 'Cara') {
  if (label === 'Barata') return 'text-status-success';
  if (label === 'Justa') return 'text-brand-primary';
  return 'text-status-warning';
}

function evaluationBadgeVariant(label: 'Barata' | 'Justa' | 'Cara'): 'success' | 'warning' | 'primary' {
  if (label === 'Barata') return 'success';
  if (label === 'Justa') return 'primary';
  return 'warning';
}

function formatSignedSilver(value: number): string {
  const sign = value > 0 ? '+' : '';

  return `${sign}${formatSilver(value)}`;
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : '';

  return `${sign}${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function statusRank(status: ListingStatus): number {
  if (status === 'available') return 1;
  if (status === 'reserved') return 2;
  return 3;
}

function getListingSellerName(listing: Pick<Weapon4Listing, 'sellerName' | 'sellerPlayerName'>): string {
  return listing.sellerPlayerName || listing.sellerName || 'Vendedor não informado';
}

function getListingSellerContact(listing: Pick<Weapon4Listing, 'sellerContact'>): string {
  return listing.sellerContact || 'Contato não informado';
}

function getListingInvestedCost(listing: Pick<Weapon4Listing, 'investedCost' | 'estimatedInvestment'>): number | undefined {
  return listing.investedCost ?? listing.estimatedInvestment;
}
