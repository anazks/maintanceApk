import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
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

const SYSTEM_HEALTH = [
  { name: 'Water Treatment', status: 'Optimal', score: 98, color: '#10B981' },
  { name: 'Manufacturing', status: 'Warning', score: 82, color: '#F59E0B' },
  { name: 'Packaging', status: 'Optimal', score: 95, color: '#10B981' },
  { name: 'Utilities', status: 'Critical', score: 65, color: '#EF4444' },
];

import { useFocusEffect } from 'expo-router';
import { getDB } from '../database';

export default function Dashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = React.useState({
    availability: '99.8%',
    downtime: '12h',
    mttr: '4.5h',
    mtbf: '312h',
    oee: 86.5,
    systemHealth: [
      { name: 'Water Treatment', status: 'Optimal', score: 98, color: '#10B981' },
      { name: 'Manufacturing', status: 'Warning', score: 82, color: '#F59E0B' },
      { name: 'Packaging', status: 'Optimal', score: 95, color: '#10B981' },
      { name: 'Utilities', status: 'Critical', score: 65, color: '#EF4444' },
    ]
  });

  useFocusEffect(
    React.useCallback(() => {
      loadMetrics();
    }, [])
  );

  const loadMetrics = () => {
    try {
      const db = getDB();
      
      // Calculate real availability based on equipment status
      const totalEq = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Equipment')?.count || 0;
      const activeEq = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Equipment WHERE status="Active"')?.count || 0;
      const maintenanceEq = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Equipment WHERE status="Under Maintenance" OR status="Maintenance"')?.count || 0;
      const availabilityPct = totalEq > 0 ? (activeEq / totalEq) * 100 : 100;

      // Mocking some sections based on real counts to make it feel alive
      const defectsCount = db.getFirstSync<{count: number}>('SELECT COUNT(*) as count FROM Defects WHERE status != "Closed"')?.count || 0;
      const maintCount = maintenanceEq;

      // Simple heuristic for system health
      const manufacturingScore = Math.max(0, 100 - (defectsCount * 5) - (maintCount * 10));
      const utilitiesScore = availabilityPct < 80 ? 65 : 92;

      setMetrics({
        availability: `${availabilityPct.toFixed(1)}%`,
        downtime: `${(totalEq - activeEq) * 4}h`, // simple heuristic
        mttr: '4.2h',
        mtbf: '328h',
        oee: parseFloat(availabilityPct.toFixed(1)),
        systemHealth: [
          { name: 'Water Treatment', status: 'Optimal', score: 98, color: '#10B981' },
          { name: 'Manufacturing', status: manufacturingScore > 80 ? 'Optimal' : manufacturingScore > 50 ? 'Warning' : 'Critical', score: manufacturingScore, color: manufacturingScore > 80 ? '#10B981' : manufacturingScore > 50 ? '#F59E0B' : '#EF4444' },
          { name: 'Packaging', status: 'Optimal', score: 95, color: '#10B981' },
          { name: 'Utilities', status: utilitiesScore > 80 ? 'Optimal' : 'Critical', score: utilitiesScore, color: utilitiesScore > 80 ? '#10B981' : '#EF4444' },
        ]
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SUJATHA Analytics</Text>
          <TouchableOpacity style={styles.addButtonSmall}>
            <Ionicons name="download-outline" size={20} color="#2563EB" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Main KPI Card */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Text style={styles.kpiTitle}>Overall OEE</Text>
              <View style={styles.kpiBadge}>
                <Ionicons name="trending-up" size={12} color="#10B981" />
                <Text style={styles.kpiBadgeText}>+2.4%</Text>
              </View>
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiValue}>{metrics.oee}<Text style={styles.kpiSymbol}>%</Text></Text>
              <Text style={styles.kpiSubtitle}>Target: 85.0%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${metrics.oee}%` }]} />
            </View>
          </View>

          {/* Grid Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="flash-outline" size={20} color="#2563EB" />
              </View>
              <Text style={styles.statValue}>{metrics.availability}</Text>
              <Text style={styles.statLabel}>Availability</Text>
            </View>
            <View style={styles.statBox}>
              <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="hourglass-outline" size={20} color="#EF4444" />
              </View>
              <Text style={styles.statValue}>{metrics.downtime}</Text>
              <Text style={styles.statLabel}>Est. Downtime</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="construct-outline" size={20} color="#F97316" />
              </View>
              <Text style={styles.statValue}>{metrics.mttr}</Text>
              <Text style={styles.statLabel}>MTTR</Text>
            </View>
            <View style={styles.statBox}>
              <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="checkmark-done-circle-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{metrics.mtbf}</Text>
              <Text style={styles.statLabel}>MTBF</Text>
            </View>
          </View>

          {/* System Health Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>System Health</Text>
            <View style={styles.healthCard}>
              {metrics.systemHealth.map((system, index) => (
                <View key={system.name} style={[styles.healthRow, index === metrics.systemHealth.length - 1 && styles.healthRowLast]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.healthName}>{system.name}</Text>
                    <View style={styles.healthBarBg}>
                      <View style={[styles.healthBarFill, { width: `${system.score}%`, backgroundColor: system.color }]} />
                    </View>
                  </View>
                  <View style={styles.healthScoreContainer}>
                    <Text style={[styles.healthScore, { color: system.color }]}>{system.score}%</Text>
                    <Text style={styles.healthStatus}>{system.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  addButtonSmall: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  kpiCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 2,
  },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  kpiTitle: { fontSize: 16, fontWeight: '600', color: '#4B5563' },
  kpiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  kpiBadgeText: { color: '#10B981', fontSize: 12, fontWeight: '600' },
  kpiContent: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 20 },
  kpiValue: { fontSize: 48, fontWeight: '700', color: '#111827', letterSpacing: -1 },
  kpiSymbol: { fontSize: 24, color: '#6B7280', fontWeight: '500' },
  kpiSubtitle: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 4 },

  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statBox: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 2,
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  section: { marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 },
  healthCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 2,
  },
  healthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  healthRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  healthName: { fontSize: 15, fontWeight: '500', color: '#374151', marginBottom: 8 },
  healthBarBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, width: '100%', overflow: 'hidden' },
  healthBarFill: { height: '100%', borderRadius: 3 },
  healthScoreContainer: { alignItems: 'flex-end', minWidth: 70, paddingLeft: 16 },
  healthScore: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  healthStatus: { fontSize: 11, color: '#6B7280', fontWeight: '500' }
});
