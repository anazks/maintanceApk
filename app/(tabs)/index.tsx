import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
    title: 'Maintenance',
    subtitle: '18 pending · 2 overdue',
    icon: 'build-outline',
    route: '/maintenance',
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
  },
  {
    key: 'analytics',
    title: 'Analytics',
    subtitle: 'Performance metrics',
    icon: 'stats-chart-outline',
    route: '/dashboard',
  },
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
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Ionicons name={item.icon as any} size={16} color="#6B7280" />
        <Text style={styles.statChange}>{item.change}</Text>
      </View>
      <Text style={styles.statValue}>{item.value}</Text>
      <Text style={styles.statLabel}>{item.label}</Text>
    </View>
  );
}

function MenuCard({ item, index }: { item: any, index: number }) {
  const router = useRouter();
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
        style={styles.menuCard}
        onPress={() => router.push(item.route)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <View style={styles.menuCardLeft}>
          <View style={styles.iconBox}>
            <Ionicons name={item.icon} size={22} color="#2563EB" />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          </View>
        </View>

        {/* Visual indicators that this is clickable */}
        <View style={styles.actionIndicator}>
          <Ionicons name="chevron-forward" size={18} color="#2563EB" />
          <View style={styles.pressHint} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <View style={styles.activityCard}>
      <View style={styles.activityLeft}>
        <View style={[
          styles.activityDot,
          { backgroundColor: item.status === 'completed' ? '#10B981' : '#F59E0B' }
        ]} />
        <View>
          <Text style={styles.activityAction}>{item.action}</Text>
          <Text style={styles.activityItem}>{item.item}</Text>
        </View>
      </View>
      <Text style={styles.activityTime}>{item.time}</Text>
    </View>
  );
}

import { useFocusEffect } from 'expo-router';
import { getDB } from '../../database';

export default function Index() {
  const router = useRouter();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const [stats, setStats] = React.useState<StatItem[]>([
    { label: 'Total Equipment', value: '0', change: '0', icon: 'layers-outline' },
    { label: 'Active', value: '0', change: '0%', icon: 'checkmark-circle-outline' },
    { label: 'Maintenance', value: '0', change: '0%', icon: 'construct-outline' },
    { label: 'Defects', value: '0', change: '0', icon: 'alert-circle-outline' },
  ]);

  const [activities, setActivities] = React.useState<ActivityItem[]>([]);
  const [deficientParts, setDeficientParts] = React.useState(0);
  const [openDefectsCount, setOpenDefectsCount] = React.useState(0);
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
      
      setDeficientParts(defParts);

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
          return { ...item, subtitle: `${openDefects} open reports` };
        }
        if (item.key === 'parts') {
          return { ...item, subtitle: `${totalParts} items in stock` };
        }
        return item;
      }));

      const actPct = totalEq > 0 ? Math.round((activeEq / totalEq)*100) : 0;
      const mnPct = totalEq > 0 ? Math.round((maintEq / totalEq)*100) : 0;

      setStats([
        { label: 'Total Equipment', value: totalEq.toString(), change: `New`, icon: 'layers-outline' },
        { label: 'Active', value: activeEq.toString(), change: `${actPct}%`, icon: 'checkmark-circle-outline' },
        { label: 'Maintenance', value: maintEq.toString(), change: `${mnPct}%`, icon: 'construct-outline' },
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>SUJATHA</Text>
            <Text style={styles.greeting}>{greeting}, Inspector</Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#2563EB" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <StatCard key={stat.label} item={stat} index={index} />
          ))}
        </View>

        {deficientParts > 0 && (
          <TouchableOpacity 
            style={styles.alertBanner}
            onPress={() => router.push('/parts')}
          >
            <Ionicons name="warning" size={20} color="#991B1B" />
            <Text style={styles.alertText}>
              <Text style={{ fontWeight: '700' }}>{deficientParts} parts</Text> require restocking. Tap to view inventory.
            </Text>
          </TouchableOpacity>
        )}

        {openDefectsCount > 0 && (
          <TouchableOpacity 
            style={[styles.alertBanner, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}
            onPress={() => router.push('/report')}
          >
            <Ionicons name="alert-circle" size={20} color="#C2410C" />
            <Text style={[styles.alertText, { color: '#C2410C' }]}>
              <Text style={{ fontWeight: '700' }}>{openDefectsCount} defects</Text> reported and pending resolution.
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#C2410C" />
          </TouchableOpacity>
        )}

        {/* Quick Actions Label with Action Hint */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionChip}>
              <Ionicons name="hand-right-outline" size={14} color="#2563EB" />
              <Text style={styles.actionChipText}>Tap to navigate</Text>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Cards - Clearly Buttons */}
        <View style={styles.menuList}>
          {menuItems.map((item: any, index: number) => (
            <MenuCard key={item.key} item={item} index={index} />
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Maintenance logs</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityList}>
          {activities.length > 0 ? activities.map((activity) => (
            <ActivityCard key={activity.id} item={activity} />
          )) : <Text style={{textAlign: 'center', color: '#6B7280'}}>No recent maintenance records.</Text>}
        </View>

        {/* Footer Metrics */}
        <View style={styles.footerMetrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>SUJATHA Status</Text>
            <View style={styles.metricValueRow}>
              <View style={styles.statusDot} />
              <Text style={styles.metricValue}>System Operational</Text>
            </View>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Last Sync</Text>
            <Text style={styles.metricValue}>Just now</Text>
          </View>
        </View>
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