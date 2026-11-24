import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SupportConversation } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { InboxView } from '@/features/support/InboxView';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { formatDateLong } from '@/utils/format';

export type AccountTab = 'profile' | 'inbox' | 'reservations';

// Pirmosios vardo ir pavardės raidės apskritime vietoje nuotraukos (nuotraukų programėlė nerenka).
export function initials(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={typography.label}>{label}</Text>
      <Text style={typography.body}>{value}</Text>
    </View>
  );
}

type Props = {
  // Pašto dėžutės veiksmai; jei neperduoti, skirtukas nerodomas.
  onOpenConversation?: (conversation: SupportConversation) => void;
  onNewConversation?: () => void;
  // Pasikeitus skaičiui pašto dėžutė atnaujinama.
  inboxRefreshKey?: number;
  reservations?: ReactNode;
  // Tik kūrimo režimu: nuoroda į dizaino peržiūrą.
  onOpenPreview?: () => void;
};

type ProfileLoad = 'idle' | 'loading' | 'failed';

// Paskyros ekranas „Mano paskyra“: avataras, skirtukai ir pasirinkto skirtuko turinys.
export function AccountView(props: Props = {}) {
  const { customer, signOut, refreshCustomer } = useAuth();
  const [tab, setTab] = useState<AccountTab>('profile');
  const hasInbox = Boolean(props.onOpenConversation && props.onNewConversation);

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  // Atkūrus sesiją AuthContext profilį užklausia fone ir jo nesėkmės nepraneša (customer lieka null).
  // Todėl, kai profilio nėra, šis ekranas užklausia pats ir rodo savo užklausos būseną.
  const [profileLoad, setProfileLoad] = useState<ProfileLoad>(customer ? 'idle' : 'loading');
  const profileBusyRef = useRef(false);
  const loadProfile = useCallback(async () => {
    if (profileBusyRef.current) {
      return;
    }
    profileBusyRef.current = true;
    setProfileLoad('loading');
    try {
      await refreshCustomer();
      if (mountedRef.current) setProfileLoad('idle');
    } catch {
      if (mountedRef.current) setProfileLoad('failed');
    } finally {
      profileBusyRef.current = false;
    }
  }, [refreshCustomer]);

  const hasCustomer = customer !== null && customer !== undefined;
  useEffect(() => {
    if (!hasCustomer) {
      void loadProfile();
    }
    // Tik atidarius ekraną; vėliau – mygtuku „Bandyti dar kartą“.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nepavykęs atsijungimas (pvz. nepavyko ištrinti tokeno) sesijos nekeičia, todėl rodoma klaida.
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const signingOutRef = useRef(false);
  async function handleSignOut() {
    if (signingOutRef.current) {
      return;
    }
    signingOutRef.current = true;
    setSigningOut(true);
    setLogoutError(null);
    try {
      await signOut();
    } catch {
      if (mountedRef.current) setLogoutError(lt.account.logoutFailed);
    } finally {
      signingOutRef.current = false;
      if (mountedRef.current) setSigningOut(false);
    }
  }

  const tabs: { key: AccountTab; label: string }[] = [
    { key: 'profile', label: lt.account.tabs.profile },
    ...(hasInbox ? [{ key: 'inbox' as const, label: lt.account.tabs.inbox }] : []),
    ...(props.reservations ? [{ key: 'reservations' as const, label: lt.account.tabs.reservations }] : []),
  ];

  let profileContent;
  if (customer) {
    profileContent = (
      <Card testID="account-profile">
        <Text style={styles.cardTitle}>{lt.account.profileTitle}</Text>
        <Row label={lt.account.name} value={`${customer.vardas} ${customer.pavarde}`} />
        <Row label={lt.account.email} value={customer.el_pastas} />
        <Row label={lt.account.phone} value={customer.telefono_nr} />
        {customer.registracijos_data ? (
          <Row label={lt.account.memberSince} value={formatDateLong(customer.registracijos_data.slice(0, 10))} />
        ) : null}
      </Card>
    );
  } else if (profileLoad === 'loading') {
    profileContent = <LoadingView />;
  } else {
    profileContent = <ErrorView message={lt.account.profileUnavailable} onRetry={() => void loadProfile()} />;
  }

  return (
    <View style={styles.fill}>
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.avatarText}>{customer ? initials(customer.vardas, customer.pavarde) : '?'}</Text>
        </View>
        <View style={styles.headerTexts}>
          <Text style={typography.title} accessibilityRole="header">
            {lt.account.title}
          </Text>
          {customer ? <Text style={typography.caption}>{lt.account.greeting(customer.vardas)}</Text> : null}
        </View>
      </View>

      {tabs.length > 1 ? (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {tabs.map((item) => (
              <Chip key={item.key} label={item.label} selected={tab === item.key} onPress={() => setTab(item.key)} testID={`account-tab-${item.key}`} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {tab === 'profile' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {profileContent}
          {logoutError ? (
            <Text style={styles.error} accessibilityRole="alert" testID="account-logout-error">
              {logoutError}
            </Text>
          ) : null}
          <Button
            label={lt.account.logout}
            accessibilityHint={lt.account.logoutHint}
            onPress={() => void handleSignOut()}
            loading={signingOut}
            variant="secondary"
            icon="log-out-outline"
            testID="account-logout"
          />
          {__DEV__ && props.onOpenPreview ? (
            <Button label={lt.preview.open} onPress={props.onOpenPreview} variant="ghost" testID="account-preview" style={styles.previewButton} />
          ) : null}
        </ScrollView>
      ) : null}

      {tab === 'inbox' && props.onOpenConversation && props.onNewConversation ? (
        <InboxView onOpen={props.onOpenConversation} onNew={props.onNewConversation} refreshKey={props.inboxRefreshKey} />
      ) : null}
      {tab === 'reservations' ? <View style={styles.fill}>{props.reservations}</View> : null}
    </View>
  );
}

const AVATAR = 64;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: colors.textOnBrand },
  headerTexts: { flex: 1 },
  tabs: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  content: { padding: spacing.lg, paddingTop: 0, flexGrow: 1 },
  cardTitle: { ...typography.heading, marginBottom: spacing.md },
  row: { marginBottom: spacing.md, gap: 2 },
  error: { ...typography.bodyStrong, color: colors.danger, marginVertical: spacing.md },
  previewButton: { marginTop: spacing.md },
});
