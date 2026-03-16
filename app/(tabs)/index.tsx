import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useRef } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getDB } from '../../database';

const DEFAULT_MENU_ITEMS = [
  {
    key: 'scan',
    title: 'Scan',
    subtitle: 'QR & Barcode',
    icon: 'qr-code-outline',
    route: '/qr-scanner',
    color: '#6366F1',
    bg: '#EEF2FF',
    bgDark: '#1e1b4b',
  },
  {
    key: 'list',
    title: 'Equipment',
    subtitle: '247 items',
    icon: 'hardware-chip-outline',
    route: '/equipment',
    color: '#0EA5E9',
    bg: '#E0F2FE',
    bgDark: '#0c2340',
  },
  {
    key: 'add',
    title: 'Add Asset',
    subtitle: 'Register new',
    icon: 'add-circle-outline',
    route: '/add-equipment',
    color: '#10B981',
    bg: '#D1FAE5',
    bgDark: '#052e16',
  },
  {
    key: 'maint',
    title: 'Routines',
    subtitle: '18 pending',
    icon: 'build-outline',
    route: '/routines',
    color: '#F59E0B',
    bg: '#FEF3C7',
    bgDark: '#2d1b00',
  },
  {
    key: 'defect',
    title: 'Defects',
    subtitle: '7 open',
    icon: 'warning-outline',
    route: '/report',
    color: '#EF4444',
    bg: '#FEE2E2',
    bgDark: '#3b0000',
  },
  {
    key: 'parts',
    title: 'Spare Parts',
    subtitle: '156 in stock',
    icon: 'cube-outline',
    route: '/parts',
    color: '#8B5CF6',
    bg: '#EDE9FE',
    bgDark: '#1e1240',
  },
  {
    key: 'vessel',
    title: 'Add Vessel',
    subtitle: 'New Ship',
    icon: 'boat-outline',
    route: '/vessels?add=true',
    color: '#EC4899',
    bg: '#FCE7F3',
    bgDark: '#500724',
  },
  {
    key: 'cat',
    title: 'Add Category',
    subtitle: 'New Spare Cat',
    icon: 'apps-outline',
    route: '/settings?tab=Categories&addCat=true',
    color: '#06B6D4',
    bg: '#CFFAFE',
    bgDark: '#083344',
  },
];

interface StatItem {
  label: string;
  value: string;
  change: string;
  icon: string;
  color: string;
  bg: string;
  bgDark: string;
}

interface ActivityItem {
  id: number;
  action: string;
  item: string;
  time: string;
  status: string;
}

function StatCard({ item, cardWidth, dark, isSmallScreen }: { item: StatItem; cardWidth: number; dark: boolean; isSmallScreen: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.statCard, {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      width: cardWidth,
      padding: isSmallScreen ? 6 : 8,
    }]}>
      <View style={[styles.statIconWrap, {
        backgroundColor: dark ? item.bgDark : item.bg,
        width: isSmallScreen ? 20 : 24,
        height: isSmallScreen ? 20 : 24,
        borderRadius: isSmallScreen ? 5 : 6,
      }]}>
        <Ionicons name={item.icon as any} size={isSmallScreen ? 12 : 14} color={item.color} />
      </View>
      <Text style={[styles.statValue, {
        color: theme.colors.text,
        fontSize: isSmallScreen ? 12 : 14,
      }]}>{item.value}</Text>
      <Text style={[styles.statLabel, {
        color: theme.colors.textSecondary,
        fontSize: isSmallScreen ? 8 : 9,
      }]}>{item.label}</Text>
      <View style={[styles.statPill, {
        backgroundColor: dark ? item.bgDark : item.bg,
        paddingHorizontal: isSmallScreen ? 3 : 4,
      }]}>
        <Text style={[styles.statChange, {
          color: item.color,
          fontSize: isSmallScreen ? 7 : 8,
        }]}>{item.change}</Text>
      </View>
    </View>
  );
}

function MenuCard({ item, cardWidth, isSmallScreen }: { item: any; cardWidth: number; isSmallScreen: boolean }) {
  const router = useRouter();
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true, speed: 150 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 150 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], width: cardWidth }}>
      <TouchableOpacity
        style={[styles.menuCard, {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          padding: isSmallScreen ? 6 : 8,
        }]}
        onPress={() => router.push(item.route)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <View style={[styles.menuIconCircle, {
          backgroundColor: theme.dark ? item.bgDark : item.bg,
          width: isSmallScreen ? 32 : 36,
          height: isSmallScreen ? 32 : 36,
          borderRadius: isSmallScreen ? 10 : 12,
          marginBottom: isSmallScreen ? 4 : 6,
        }]}>
          <Ionicons name={item.icon} size={isSmallScreen ? 16 : 18} color={item.color} />
        </View>
        <Text style={[styles.menuTitle, {
          color: theme.colors.text,
          fontSize: isSmallScreen ? 9 : 10,
        }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.menuSubtitle, {
          color: theme.colors.textSecondary,
          fontSize: isSmallScreen ? 7 : 8,
          lineHeight: isSmallScreen ? 9 : 10,
        }]} numberOfLines={1}>
          {item.subtitle}
        </Text>
        {item.badge ? (
          <View style={[styles.menuBadge, {
            backgroundColor: item.color,
            minWidth: isSmallScreen ? 14 : 16,
            height: isSmallScreen ? 14 : 16,
            borderRadius: isSmallScreen ? 7 : 8,
            top: isSmallScreen ? 3 : 4,
            right: isSmallScreen ? 3 : 4,
          }]}>
            <Text style={[styles.menuBadgeText, { fontSize: isSmallScreen ? 7 : 8 }]}>{item.badge}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

function ActivityCard({ item, isSmallScreen }: { item: ActivityItem; isSmallScreen: boolean }) {
  const { theme } = useTheme();
  const isCompleted = item.status === 'completed';
  return (
    <View style={[styles.activityCard, { borderBottomColor: theme.colors.border, paddingVertical: isSmallScreen ? 6 : 8 }]}>
      <View style={[styles.activityIconWrap, {
        backgroundColor: isCompleted
          ? (theme.dark ? '#052e16' : '#D1FAE5')
          : (theme.dark ? '#2d1b00' : '#FEF3C7'),
        width: isSmallScreen ? 22 : 26,
        height: isSmallScreen ? 22 : 26,
        borderRadius: isSmallScreen ? 7 : 8,
      }]}>
        <Ionicons
          name={isCompleted ? 'checkmark-circle' : 'time'}
          size={isSmallScreen ? 12 : 14}
          color={isCompleted ? '#10B981' : '#F59E0B'}
        />
      </View>
      <View style={styles.activityMiddle}>
        <Text style={[styles.activityAction, {
          color: theme.colors.text,
          fontSize: isSmallScreen ? 10 : 11,
        }]}>{item.action}</Text>
        <Text style={[styles.activityItem, {
          color: theme.colors.textSecondary,
          fontSize: isSmallScreen ? 8 : 9,
        }]}>{item.item}</Text>
      </View>
      <Text style={[styles.activityTime, {
        color: theme.colors.textSecondary,
        fontSize: isSmallScreen ? 8 : 9,
      }]}>{item.time}</Text>
    </View>
  );
}

export default function Index() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const { user, logout } = useAuth();
  const [showProfileModal, setShowProfileModal] = React.useState(false);

  // Responsive breakpoints
  const isSmallScreen = width < 375; // iPhone SE / small devices
  const isMediumScreen = width >= 375 && width < 768;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const isAdmin = user?.role === 'Admin';

  // Responsive padding and gaps
  const screenPadding = isSmallScreen ? 8 : 12;
  const cardGap = isSmallScreen ? 4 : 6;

  // Calculate card widths based on screen size
  // Stats: always 4 per row but adjust size
  const statCardWidth = (width - screenPadding * 2 - cardGap * 3) / 4;

  // Quick actions: 4 per row on medium, 3 per row on small
  const menuCols = isSmallScreen ? 3 : 4;
  const menuCardWidth = (width - screenPadding * 2 - cardGap * (menuCols - 1)) / menuCols;

  const STAT_META = [
    { color: '#6366F1', bg: '#EEF2FF', bgDark: '#1e1b4b' },
    { color: '#10B981', bg: '#D1FAE5', bgDark: '#052e16' },
    { color: '#F59E0B', bg: '#FEF3C7', bgDark: '#2d1b00' },
    { color: '#EF4444', bg: '#FEE2E2', bgDark: '#3b0000' },
  ];

  const [stats, setStats] = React.useState<StatItem[]>([
    { label: 'Total', value: '0', change: 'New', icon: 'layers-outline', ...STAT_META[0] },
    { label: 'Active', value: '0', change: '0%', icon: 'checkmark-circle-outline', ...STAT_META[1] },
    { label: 'Maint', value: '0', change: '0%', icon: 'construct-outline', ...STAT_META[2] },
    { label: 'Defects', value: '0', change: 'Issues', icon: 'alert-circle-outline', ...STAT_META[3] },
  ]);

  const [activities, setActivities] = React.useState<ActivityItem[]>([]);
  const [deficientParts, setDeficientParts] = React.useState(0);
  const [openDefectsCount, setOpenDefectsCount] = React.useState(0);
  const [overdueRoutinesCount, setOverdueRoutinesCount] = React.useState(0);
  const [menuItems, setMenuItems] = React.useState(DEFAULT_MENU_ITEMS);

  useFocusEffect(
    React.useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = () => {
    try {
      const db = getDB();
      const totalEq = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM Equipment')?.count || 0;
      const activeEq = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM Equipment WHERE status="Active"')?.count || 0;
      const maintEq = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM Equipment WHERE status="Under Maintenance" OR status="Maintenance"')?.count || 0;
      const defectsCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM Defects WHERE status != "Closed"')?.count || 0;
      const totalParts = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM Spare_Parts')?.count || 0;
      const defParts = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM Spare_Parts WHERE available_quantity <= minimum_quantity')?.count || 0;

      const todayShort = new Date().toISOString().split('T')[0];
      const overdueRoutines = db.getFirstSync<{ count: number }>(`
        SELECT COUNT(ms.id) as count 
        FROM Maintenance_Schedule ms
        LEFT JOIN Checklist_Items ci ON ms.id = ci.schedule_id
        WHERE date(ms.next_maintenance) <= date(?) AND ci.id IS NOT NULL
      `, [todayShort])?.count || 0;

      setDeficientParts(defParts);
      setOverdueRoutinesCount(overdueRoutines);

      setMenuItems((prev: any[]) =>
        prev.map((item: any) => {
          if (item.key === 'list') {
            return { ...item, subtitle: `${totalEq} items` };
          }
          if (item.key === 'maint') {
            return { ...item, subtitle: `${maintEq} pending` };
          }
          if (item.key === 'defect') {
            const openDefects = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM Defects WHERE status="Open"')?.count || 0;
            setOpenDefectsCount(openDefects);
            return { ...item, subtitle: `${openDefects} open`, badge: openDefects > 0 ? openDefects : undefined };
          }
          if (item.key === 'parts') {
            return { ...item, subtitle: `${totalParts} in stock`, badge: defParts > 0 ? defParts : undefined };
          }
          return item;
        })
      );

      const actPct = totalEq > 0 ? Math.round((activeEq / totalEq) * 100) : 0;
      const mnPct = totalEq > 0 ? Math.round((maintEq / totalEq) * 100) : 0;

      setStats([
        { label: 'Total', value: totalEq.toString(), change: 'Total', icon: 'layers-outline', ...STAT_META[0] },
        { label: 'Active', value: activeEq.toString(), change: `${actPct}%`, icon: 'checkmark-circle-outline', ...STAT_META[1] },
        { label: 'Maint', value: maintEq.toString(), change: `${mnPct}%`, icon: 'construct-outline', ...STAT_META[2] },
        { label: 'Defects', value: defectsCount.toString(), change: 'Open', icon: 'alert-circle-outline', ...STAT_META[3] },
      ]);

      const history = db.getAllSync<{ id: number; equipment_id: number; schedule_type: string; maintenance_date: string; status: string; name: string }>(
        `SELECT l.id, l.equipment_id, l.schedule_type, l.maintenance_date, l.status, e.name 
         FROM Maintenance_Log l
         JOIN Equipment e ON l.equipment_id = e.id
         ORDER BY l.maintenance_date DESC LIMIT 5`
      );

      const formattedActs = history.map((h: any) => ({
        id: h.id,
        action: `${h.schedule_type} completed`,
        item: h.name,
        time: h.maintenance_date.split('T')[0] || h.maintenance_date,
        status: h.status === 'Completed' ? 'completed' : 'pending',
      }));
      setActivities(formattedActs);
    } catch (e) {
      console.error(e);
    }
  };

  // Split menu items into rows based on columns
  const menuRows = [];
  for (let i = 0; i < menuItems.length; i += menuCols) {
    menuRows.push(menuItems.slice(i, i + menuCols));
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, {
          backgroundColor: theme.colors.background,
          paddingHorizontal: screenPadding,
          paddingTop: isSmallScreen ? 4 : 6,
          paddingBottom: isSmallScreen ? 24 : 32,
        }]}
      >
        {/* ── Minimal Header ── */}
        <View style={[styles.minimalHeader, { marginBottom: isSmallScreen ? 4 : 6 }]}>
          <Text style={[styles.brandNameSmall, {
            color: theme.colors.primary,
            fontSize: isSmallScreen ? 12 : 13,
          }]}>SUJATHA</Text>
          <TouchableOpacity
            onPress={() => setShowProfileModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.miniAvatar, {
              backgroundColor: isDarkMode ? '#1e1b4b' : '#EEF2FF',
              width: isSmallScreen ? 26 : 28,
              height: isSmallScreen ? 26 : 28,
              borderRadius: isSmallScreen ? 13 : 14,
            }]}>
              <Ionicons name="person" size={isSmallScreen ? 12 : 14} color={theme.colors.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {isAdmin && (
          <>
            {/* ── Stats Grid - Always 4 in a row but responsive sizes ── */}
            <View style={[styles.statsGrid, { gap: cardGap, marginBottom: isSmallScreen ? 6 : 8 }]}>
              {stats.map((stat, i) => (
                <StatCard
                  key={stat.label}
                  item={stat}
                  cardWidth={statCardWidth}
                  dark={isDarkMode}
                  isSmallScreen={isSmallScreen}
                />
              ))}
            </View>

            {/* ── Alert Banners ── */}
            {deficientParts > 0 && (
              <TouchableOpacity
                style={[styles.alertBanner, {
                  backgroundColor: isDarkMode ? '#1a0505' : '#FFF1F2',
                  borderColor: isDarkMode ? '#7f1d1d' : '#FECDD3',
                  padding: isSmallScreen ? 6 : 8,
                  marginBottom: isSmallScreen ? 4 : 6,
                  gap: isSmallScreen ? 4 : 6,
                }]}
                onPress={() => router.push('/parts')}
              >
                <View style={[styles.alertIcon, {
                  backgroundColor: isDarkMode ? '#3b0000' : '#FEE2E2',
                  width: isSmallScreen ? 20 : 22,
                  height: isSmallScreen ? 20 : 22,
                  borderRadius: isSmallScreen ? 5 : 6,
                }]}>
                  <Ionicons name="warning" size={isSmallScreen ? 10 : 12} color="#EF4444" />
                </View>
                <Text style={[styles.alertText, {
                  color: isDarkMode ? '#fca5a5' : '#991B1B',
                  fontSize: isSmallScreen ? 10 : 11,
                }]} numberOfLines={1}>
                  <Text style={{ fontWeight: '700' }}>{deficientParts} parts</Text> low stock
                </Text>
                <Ionicons name="chevron-forward" size={isSmallScreen ? 10 : 12} color={isDarkMode ? '#fca5a5' : '#991B1B'} />
              </TouchableOpacity>
            )}

            {overdueRoutinesCount > 0 && (
              <TouchableOpacity
                style={[styles.alertBanner, {
                  backgroundColor: isDarkMode ? '#1a1000' : '#FFFBEB',
                  borderColor: isDarkMode ? '#78350f' : '#FDE68A',
                  padding: isSmallScreen ? 6 : 8,
                  marginBottom: isSmallScreen ? 4 : 6,
                  gap: isSmallScreen ? 4 : 6,
                }]}
                onPress={() => router.push('/routines')}
              >
                <View style={[styles.alertIcon, {
                  backgroundColor: isDarkMode ? '#2d1b00' : '#FEF3C7',
                  width: isSmallScreen ? 20 : 22,
                  height: isSmallScreen ? 20 : 22,
                  borderRadius: isSmallScreen ? 5 : 6,
                }]}>
                  <Ionicons name="time" size={isSmallScreen ? 10 : 12} color="#F59E0B" />
                </View>
                <Text style={[styles.alertText, {
                  color: isDarkMode ? '#fcd34d' : '#92400E',
                  fontSize: isSmallScreen ? 10 : 11,
                }]} numberOfLines={1}>
                  <Text style={{ fontWeight: '700' }}>{overdueRoutinesCount} routines</Text> overdue
                </Text>
                <Ionicons name="chevron-forward" size={isSmallScreen ? 10 : 12} color={isDarkMode ? '#fcd34d' : '#92400E'} />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Quick Actions - Responsive columns ── */}
        <View style={[styles.sectionHeader, {
          marginTop: isSmallScreen ? 8 : 12,
          marginBottom: isSmallScreen ? 6 : 8,
          gap: isSmallScreen ? 6 : 8,
        }]}>
          <Text style={[styles.sectionTitle, {
            color: theme.colors.text,
            fontSize: isSmallScreen ? 12 : 13,
          }]}>Quick Actions</Text>
          <View style={[styles.sectionLine, { backgroundColor: theme.colors.border }]} />
        </View>

        {menuRows.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.menuGrid, { gap: cardGap, marginBottom: cardGap }]}>
            {row.map((item) => (
              <MenuCard
                key={item.key}
                item={item}
                cardWidth={menuCardWidth}
                isSmallScreen={isSmallScreen}
              />
            ))}
          </View>
        ))}

        {/* ── Recent Activity ── */}
        {isAdmin && activities.length > 0 && (
          <>
            <View style={[styles.sectionHeader, {
              marginTop: isSmallScreen ? 8 : 12,
              marginBottom: isSmallScreen ? 6 : 8,
              gap: isSmallScreen ? 6 : 8,
            }]}>
              <Text style={[styles.sectionTitle, {
                color: theme.colors.text,
                fontSize: isSmallScreen ? 12 : 13,
              }]}>Recent Logs</Text>
              <View style={[styles.sectionLine, { backgroundColor: theme.colors.border }]} />
            </View>

            <View style={[styles.activityList, {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: isSmallScreen ? 12 : 14,
            }]}>
              {activities.map((activity, idx) => (
                <ActivityCard
                  key={activity.id}
                  item={activity}
                  isSmallScreen={isSmallScreen}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Profile Modal - Responsive ── */}
      <Modal
        visible={showProfileModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProfileModal(false)}
        >
          <View style={[styles.profileModalContent, {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            width: isSmallScreen ? '90%' : '85%',
            padding: isSmallScreen ? 20 : 24,
          }]}>
            <View style={[styles.profileHeader, { gap: isSmallScreen ? 12 : 16 }]}>
              <View style={[styles.largeAvatar, {
                backgroundColor: isDarkMode ? '#1e1b4b' : '#EEF2FF',
                width: isSmallScreen ? 56 : 64,
                height: isSmallScreen ? 56 : 64,
                borderRadius: isSmallScreen ? 28 : 32,
              }]}>
                <Ionicons name="person" size={isSmallScreen ? 28 : 32} color={theme.colors.primary} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, {
                  color: theme.colors.text,
                  fontSize: isSmallScreen ? 18 : 20,
                }]}>{user?.username || 'User'}</Text>
                <Text style={[styles.profileRole, {
                  color: theme.colors.textSecondary,
                  fontSize: isSmallScreen ? 13 : 14,
                }]}>{user?.role || 'Staff'}</Text>
              </View>
            </View>

            <View style={[styles.profileDivider, { backgroundColor: theme.colors.border, marginBottom: isSmallScreen ? 12 : 16 }]} />

            <TouchableOpacity
              style={[styles.logoutButton, { paddingVertical: isSmallScreen ? 10 : 12 }]}
              onPress={async () => {
                setShowProfileModal(false);
                await logout();
                router.replace('/Login');
              }}
            >
              <Ionicons name="log-out-outline" size={isSmallScreen ? 18 : 20} color={theme.colors.error} />
              <Text style={[styles.logoutText, {
                color: theme.colors.error,
                fontSize: isSmallScreen ? 14 : 15,
              }]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    gap: 0,
  },

  minimalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  brandNameSmall: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  miniAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Stats ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCard: {
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 2,
  },
  statIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontWeight: '500',
  },
  statPill: {
    alignSelf: 'flex-start',
    paddingVertical: 1,
    borderRadius: 10,
    marginTop: 2,
  },
  statChange: {
    fontWeight: '700',
  },

  // ── Alerts ──
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  alertIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: {
    flex: 1,
  },

  // ── Section Headers ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },

  // ── Menu Grid ──
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  menuCard: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  menuSubtitle: {
    textAlign: 'center',
  },
  menuBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  menuBadgeText: {
    color: 'white',
    fontWeight: '700',
  },

  // ── Activity ──
  activityList: {
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  activityIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityMiddle: {
    flex: 1,
  },
  activityAction: {
    fontWeight: '600',
    marginBottom: 1,
  },
  activityItem: {
  },
  activityTime: {
  },

  // ── Profile Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalContent: {
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  largeAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontWeight: '700',
    marginBottom: 2,
  },
  profileRole: {
    fontWeight: '500',
  },
  profileDivider: {
    height: 1,
    width: '100%',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  logoutText: {
    fontWeight: '600',
  },
});