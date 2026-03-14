import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

const DEFAULT_MENU_ITEMS = [
  {
    key: 'scan',
    title: 'Scan Equipment',
    subtitle: 'QR & Barcode scanning',
    icon: 'qr-code-outline',
    route: '/qr-scanner',
  },
  {
    key: 'list',
    title: 'Equipment List',
    subtitle: '247 items · 3 under maintenance',
    icon: 'hardware-chip-outline',
    route: '/equipment',
  },
  {
    key: 'add',
    title: 'Add Equipment',
    subtitle: 'Register new asset',
    icon: 'add-circle-outline',
    route: '/add-equipment',
  },
  {
    key: 'maint',
    title: 'Routines',
    subtitle: '18 pending',
    icon: 'build-outline',
    route: '/routines',
  },
  {
    key: 'defect',
    title: 'Report Defect',
    subtitle: '7 open reports',
    icon: 'warning-outline',
    route: '/report',
  },
  {
    key: 'parts',
    title: 'Spare Parts',
    subtitle: '156 items in stock',
    icon: 'cube-outline',
    route: '/parts',
  }
];

// Move to dynamic state
interface StatItem {
  label: string;
  value: string;
  change: string;
  icon: string;
}

interface ActivityItem {
  id: number;
  action: string;
  item: string;
  time: string;
  status: string;
}

function StatCard({ item, index }: { item: StatItem, index: number }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.statHeader}>
        <Ionicons name={item.icon as any} size={16} color={theme.colors.textSecondary} />
        <Text style={styles.statChange}>{item.change}</Text>
      </View>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>{item.value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{item.label}</Text>
    </View>
  );
}

function MenuCard({ item, index }: { item: any, index: number }) {
  const router = useRouter();
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 100,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 100,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.menuCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={() => router.push(item.route)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <View style={styles.menuCardLeft}>
          <View style={[styles.iconBox, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF', borderColor: theme.dark ? '#1E40AF' : '#DBEAFE' }]}>
            <Ionicons name={item.icon} size={22} color={theme.colors.primary} />
          </View>
          <View style={styles.menuText}>
            <Text style={[styles.menuTitle, { color: theme.colors.text }]}>{item.title}</Text>
            <Text style={[styles.menuSubtitle, { color: theme.colors.textSecondary }]}>{item.subtitle}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {item.badge ? (
            <View style={styles.menuBadge}>
              <Text style={styles.menuBadgeText}>{item.badge}</Text>
            </View>
          ) : null}
          {/* Visual indicators that this is clickable */}
          <View style={[styles.actionIndicator, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF' }]}>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
            <View style={[styles.pressHint, { backgroundColor: theme.colors.primary }]} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ActivityCard({ item }: { item: ActivityItem }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.activityCard, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.activityLeft}>
        <View style={[
          styles.activityDot,
          { backgroundColor: item.status === 'completed' ? theme.colors.success : theme.colors.warning }
        ]} />
        <View>
          <Text style={[styles.activityAction, { color: theme.colors.text }]}>{item.action}</Text>
          <Text style={[styles.activityItem, { color: theme.colors.textSecondary }]}>{item.item}</Text>
        </View>
      </View>
      <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>{item.time}</Text>
    </View>
  );
}

import { useFocusEffect } from 'expo-router';
import { getDB } from '../../database';

export default function Index() {
  const router = useRouter();
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const isAdmin = user?.role === 'Admin';

  const [stats, setStats] = React.useState<StatItem[]>([
    { label: 'Total Equipment', value: '0', change: '0', icon: 'layers-outline' },
    { label: 'Active', value: '0', change: '0%', icon: 'checkmark-circle-outline' },
    { label: 'Routines', value: '0', change: '0%', icon: 'construct-outline' },
    { label: 'Defects', value: '0', change: '0', icon: 'alert-circle-outline' },
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
      const totalEq = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Equipment')?.count || 0;
      const activeEq = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Equipment WHERE status="Active"')?.count || 0;
      const maintEq = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Equipment WHERE status="Under Maintenance" OR status="Maintenance"')?.count || 0;
      const defectsCount = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Defects WHERE status != "Closed"')?.count || 0;
      const totalParts = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Spare_Parts')?.count || 0;
      const defParts = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Spare_Parts WHERE available_quantity <= minimum_quantity')?.count || 0;
      
      const todayShort = new Date().toISOString().split('T')[0];
      const overdueRoutines = db.getFirstSync<{count: number}>(`
        SELECT COUNT(ms.id) as count 
        FROM Maintenance_Schedule ms
        LEFT JOIN Checklist_Items ci ON ms.id = ci.schedule_id
        WHERE date(ms.next_maintenance) <= date(?) AND ci.id IS NOT NULL
      `, [todayShort])?.count || 0;
      
      setDeficientParts(defParts);
      setOverdueRoutinesCount(overdueRoutines);

      // Update Menu Items with real counts
      setMenuItems((prev: any[]) => prev.map((item: any) => {
        if (item.key === 'list') {
          return { ...item, subtitle: `${totalEq} items · ${maintEq} under maintenance` };
        }
        if (item.key === 'maint') {
          return { ...item, subtitle: `${maintEq} pending` };
        }
        if (item.key === 'defect') {
          const openDefects = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Defects WHERE status="Open"')?.count || 0;
          setOpenDefectsCount(openDefects);
          return { ...item, subtitle: `${openDefects} open reports`, badge: openDefects > 0 ? openDefects : undefined };
        }
        if (item.key === 'parts') {
          return { ...item, subtitle: `${totalParts} items in stock`, badge: defParts > 0 ? defParts : undefined };
        }
        return item;
      }));

      const actPct = totalEq > 0 ? Math.round((activeEq / totalEq)*100) : 0;
      const mnPct = totalEq > 0 ? Math.round((maintEq / totalEq)*100) : 0;

      setStats([
        { label: 'Total Equipment', value: totalEq.toString(), change: `New`, icon: 'layers-outline' },
        { label: 'Active', value: activeEq.toString(), change: `${actPct}%`, icon: 'checkmark-circle-outline' },
        { label: 'Routines', value: maintEq.toString(), change: `${mnPct}%`, icon: 'construct-outline' },
        { label: 'Defects', value: defectsCount.toString(), change: `Issues`, icon: 'alert-circle-outline' },
      ]);

      const history = db.getAllSync<{id: number, equipment_id: number, schedule_type: string, maintenance_date: string, status: string, name: string}>(
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
        status: h.status === 'Completed' ? 'completed' : 'pending'
      }));
      setActivities(formattedActs);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.surface }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { backgroundColor: theme.colors.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <View>
            <Text style={[styles.brandName, { color: theme.colors.primary }]}>SUJATHA</Text>
            <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
              {greeting}, {user?.username || 'User'} ({user?.role || 'Staff'})
            </Text>
          </View>
          <TouchableOpacity style={[styles.avatarBtn, { backgroundColor: theme.colors.surface }]} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color={theme.colors.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {isAdmin && (
          <>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              {stats.map((stat, index) => (
                <StatCard key={stat.label} item={stat} index={index} />
              ))}
            </View>

            {deficientParts > 0 && (
              <TouchableOpacity 
                style={[styles.alertBanner, { backgroundColor: theme.dark ? '#450a0a' : '#FEE2E2', borderColor: theme.dark ? '#7f1d1d' : '#FCA5A5' }]}
                onPress={() => router.push('/parts')}
              >
                <Ionicons name="warning" size={20} color={theme.dark ? '#f87171' : '#991B1B'} />
                <Text style={[styles.alertText, { color: theme.dark ? '#fecaca' : '#991B1B' }]}>
                  <Text style={{ fontWeight: '700' }}>{deficientParts} parts</Text> require restocking. Tap to view inventory.
                </Text>
              </TouchableOpacity>
            )}

            {overdueRoutinesCount > 0 && (
              <TouchableOpacity 
                style={[styles.alertBanner, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}
                onPress={() => router.push('/routines')}
              >
                <Ionicons name="time" size={20} color="#DC2626" />
                <Text style={[styles.alertText, { color: '#DC2626' }]}>
                  <Text style={{ fontWeight: '700' }}>{overdueRoutinesCount} routines</Text> are overdue or due today!
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#DC2626" />
              </TouchableOpacity>
            )}

            {openDefectsCount > 0 && (
              <TouchableOpacity 
                style={[styles.alertBanner, { backgroundColor: theme.dark ? '#431407' : '#FFF7ED', borderColor: theme.dark ? '#7c2d12' : '#FED7AA' }]}
                onPress={() => router.push('/report')}
              >
                <Ionicons name="alert-circle" size={20} color={theme.dark ? '#fb923c' : '#C2410C'} />
                <Text style={[styles.alertText, { color: theme.dark ? '#ffedd5' : '#C2410C' }]}>
                  <Text style={{ fontWeight: '700' }}>{openDefectsCount} defects</Text> reported and pending resolution.
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.dark ? '#fb923c' : '#C2410C'} />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Quick Actions Label with Action Hint */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>
            <View style={[styles.actionChip, { backgroundColor: theme.dark ? '#1E3A8A' : '#EFF6FF' }]}>
              <Ionicons name="hand-right-outline" size={14} color={theme.colors.primary} />
              <Text style={[styles.actionChipText, { color: theme.colors.primary }]}>Tap to navigate</Text>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Cards - Clearly Buttons */}
        <View style={styles.menuList}>
          {menuItems.map((item: any, index: number) => (
            <MenuCard key={item.key} item={item} index={index} />
          ))}
        </View>

        {isAdmin && (
          <>
            {/* Recent Activity */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Routine Logs</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.activityList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              {activities.length > 0 ? activities.map((activity) => (
                <ActivityCard key={activity.id} item={activity} />
              )) : <Text style={{textAlign: 'center', color: theme.colors.textSecondary}}>No recent routine records.</Text>}
            </View>

            {/* Footer Metrics */}
            <View style={[styles.footerMetrics, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>SUJATHA Status</Text>
                <View style={styles.metricValueRow}>
                  <View style={[styles.statusDot, { backgroundColor: theme.colors.success }]} />
                  <Text style={[styles.metricValue, { color: theme.colors.text }]}>System Operational</Text>
                </View>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { color: theme.colors.text }]}>{stats[2]?.value || '0'}</Text>
                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Pending Routines</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: -1,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  alertBanner: {
    backgroundColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 24,
  },
  alertText: {
    fontSize: 13,
    color: '#991B1B',
  },
  statCard: {
    flex: 1,
    minWidth: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statChange: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  actionChipText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '500',
  },
  viewAllText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },

  // Menu List - Clearly Buttons
  menuList: {
    gap: 10,
    marginBottom: 32,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  menuCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
  },
  actionIndicator: {
    position: 'relative',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressHint: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: '#2563EB',
    opacity: 0.1,
  },
  menuBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Activity List
  activityList: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 32,
  },
  activityCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  activityItem: {
    fontSize: 13,
    color: '#6B7280',
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Footer Metrics
  footerMetrics: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  metricDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
});