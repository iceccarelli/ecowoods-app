import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

type Status = 'quoted' | 'deposit_paid' | 'scheduled' | 'completed';

interface Quote {
  id: number;
  name: string;
  sqft: number;
  total: number;
  status: Status;
  date: string;
  installer?: string;
}

const MOCK: Quote[] = [
  { id: 101, name: 'Solid White Oak - Natural', sqft: 680, total: 10030, status: 'quoted', date: 'May 28', installer: 'Mike R.' },
  { id: 102, name: 'Engineered Walnut', sqft: 420, total: 5250, status: 'deposit_paid', date: 'May 22', installer: 'Sarah T.' },
  { id: 103, name: 'Hard Maple - Clear', sqft: 1150, total: 12938, status: 'scheduled', date: 'May 10', installer: 'James K.' },
];

const STATUS = {
  quoted: { label: 'Quote Ready', color: '#2E7D32', bg: '#E8F5E9' },
  deposit_paid: { label: 'Deposit Paid', color: '#1565C0', bg: '#E3F2FD' },
  scheduled: { label: 'Scheduled', color: '#6A1B9A', bg: '#F3E5F5' },
  completed: { label: 'Completed', color: '#0A3D2E', bg: '#E8F5E9' },
};

export default function OrdersScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | 'quotes' | 'completed'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>(MOCK);

  const filtered = quotes.filter(q => {
    if (activeTab === 'quotes') return q.status !== 'completed';
    if (activeTab === 'completed') return q.status === 'completed';
    return true;
  });

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleAction = (quote: Quote) => {
    if (quote.status === 'quoted') {
      alert(`💳 Pay 25% Deposit\n\n$${ (quote.total * 0.25).toFixed(2) }`);
    } else if (quote.status === 'deposit_paid' || quote.status === 'scheduled') {
      alert(`📅 ${quote.installer} • ${quote.date}`);
    } else {
      alert('⭐ Thank you for your review!');
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A3D2E" />}>
      <View style={s.header}>
        <Text style={s.title}>Orders & Quotes</Text>
        <Text style={s.subtitle}>Track your purchases and quotes</Text>
      </View>

      <View style={s.tabs}>
        {[
          { key: 'all', label: 'All' },
          { key: 'quotes', label: 'Active' },
          { key: 'completed', label: 'Completed' },
        ].map(tab => (
          <Pressable key={tab.key} style={[s.tab, activeTab === tab.key && s.tabActive]} onPress={() => setActiveTab(tab.key as any)}>
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No orders yet</Text>
          <Pressable style={s.primaryBtn} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={s.primaryBtnText}>Browse Collection</Text>
          </Pressable>
        </View>
      ) : (
        filtered.map(quote => {
          const config = STATUS[quote.status];
          return (
            <View key={quote.id} style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardName}>{quote.name}</Text>
                <View style={[s.statusBadge, { backgroundColor: config.bg }]}>
                  <Text style={[s.statusText, { color: config.color }]}>{config.label}</Text>
                </View>
              </View>
              <Text style={s.cardMeta}>{quote.sqft} sq ft • ${quote.total.toFixed(2)} • {quote.date}</Text>
              {quote.installer && <Text style={s.installer}>👷 {quote.installer}</Text>}
              <Pressable style={s.actionBtn} onPress={() => handleAction(quote)}>
                <Text style={s.actionText}>
                  {quote.status === 'quoted' ? 'Approve & Pay Deposit' : 
                   quote.status === 'deposit_paid' || quote.status === 'scheduled' ? 'View Schedule' : 'Leave Review'}
                </Text>
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F1E9' },
  content: { padding: 24 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#0A3D2E' },
  subtitle: { color: '#6B5B4F', fontSize: 15, marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 999, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: '#ECE4D8' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: '#0A3D2E' },
  tabText: { color: '#6B5B4F', fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#0A3D2E', marginBottom: 20 },
  primaryBtn: { backgroundColor: '#0A3D2E', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#ECE4D8' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 17, fontWeight: '800', color: '#0A3D2E', flex: 1, paddingRight: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '800' },
  cardMeta: { color: '#6B5B4F', fontSize: 13, marginTop: 8 },
  installer: { color: '#0A3D2E', fontSize: 13, marginTop: 4, fontWeight: '600' },
  actionBtn: { backgroundColor: '#0A3D2E', paddingVertical: 13, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  actionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
