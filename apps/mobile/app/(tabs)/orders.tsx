import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Modal } from 'react-native';
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
  finish?: string;
}

const MOCK: Quote[] = [
  { id: 101, name: 'Solid White Oak - Natural', sqft: 680, total: 10030, status: 'quoted', date: 'May 28', installer: 'Mike R.', finish: 'Natural' },
  { id: 102, name: 'Engineered Walnut', sqft: 420, total: 5250, status: 'deposit_paid', date: 'May 22', installer: 'Sarah T.', finish: 'Matte' },
  { id: 103, name: 'Hard Maple - Clear', sqft: 1150, total: 12938, status: 'scheduled', date: 'May 10', installer: 'James K.', finish: 'Premium Oil' },
];

const STATUS = {
  quoted: { label: 'Quote Ready', color: '#2E7D32', bg: '#E8F5E9', step: 1 },
  deposit_paid: { label: 'Deposit Paid', color: '#1565C0', bg: '#E3F2FD', step: 2 },
  scheduled: { label: 'Scheduled', color: '#6A1B9A', bg: '#F3E5F5', step: 3 },
  completed: { label: 'Completed', color: '#0A3D2E', bg: '#E8F5E9', step: 4 },
};

export default function OrdersScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | 'quotes' | 'completed'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>(MOCK);
  const [showChat, setShowChat] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [chatMessages, setChatMessages] = useState<string[]>([
    "Hi! Your install is confirmed for next week. Any questions?",
    "Looking forward to it! Can we do morning slot?"
  ]);

  const filtered = quotes.filter(q => {
    if (activeTab === 'quotes') return q.status !== 'completed';
    if (activeTab === 'completed') return q.status === 'completed';
    return true;
  });

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate new quote arriving
    setTimeout(() => {
      if (Math.random() > 0.6 && quotes.length < 5) {
        const newQuote: Quote = {
          id: Date.now(),
          name: 'New Solid Hickory Quote',
          sqft: 550,
          total: 7425,
          status: 'quoted',
          date: 'Just now',
          installer: 'Team Eco',
        };
        setQuotes(prev => [newQuote, ...prev]);
      }
      setRefreshing(false);
    }, 800);
  };

  const handleAction = (quote: Quote) => {
    if (quote.status === 'quoted') {
      alert(`💳 Pay 25% Deposit\n\n$${ (quote.total * 0.25).toFixed(2) }\n\n✅ Funds held securely until install complete`);
      // Simulate payment success
      setTimeout(() => {
        setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'deposit_paid' } : q));
      }, 1200);
    } else if (quote.status === 'deposit_paid' || quote.status === 'scheduled') {
      setSelectedQuote(quote);
      setShowChat(true);
    } else {
      alert('⭐ Thank you! Your review helps other homeowners.\n\n5 stars submitted.');
    }
  };

  const sendChatMessage = () => {
    setChatMessages(prev => [...prev, "Thanks! Will confirm details shortly."]);
    setTimeout(() => {
      setChatMessages(prev => [...prev, "Perfect. See you Tuesday 9am!"]);
    }, 800);
  };

  const StatusStepper = ({ status }: { status: Status }) => {
    const currentStep = STATUS[status].step;
    return (
      <View style={s.stepper}>
        {[1,2,3,4].map((step, i) => (
          <View key={i} style={s.stepContainer}>
            <View style={[s.stepDot, step <= currentStep && s.stepDotActive]} />
            {i < 3 && <View style={[s.stepLine, step < currentStep && s.stepLineActive]} />}
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView 
      style={s.screen} 
      contentContainerStyle={s.content} 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A3D2E" />}
    >
      <View style={s.header}>
        <Text style={s.title}>Orders & Quotes</Text>
        <Text style={s.subtitle}>Track your purchases and quotes • Real-time updates</Text>
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
          <Text style={s.emptySub}>Your quotes and installs will appear here</Text>
          <Pressable style={s.primaryBtn} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={s.primaryBtnText}>Browse Collection & Get Quote</Text>
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
              
              <StatusStepper status={quote.status} />
              
              <Text style={s.cardMeta}>
                {quote.sqft} sq ft • ${quote.total.toFixed(2)} • {quote.date}
                {quote.finish && ` • ${quote.finish} finish`}
              </Text>
              {quote.installer && <Text style={s.installer}>👷 {quote.installer}</Text>}

              <Pressable style={s.actionBtn} onPress={() => handleAction(quote)}>
                <Text style={s.actionText}>
                  {quote.status === 'quoted' ? '💳 Approve & Pay 25% Deposit' : 
                   quote.status === 'deposit_paid' || quote.status === 'scheduled' ? '💬 Message Installer' : '⭐ Leave Review'}
                </Text>
              </Pressable>
            </View>
          );
        })
      )}

      {/* Floating CTA */}
      <Pressable style={s.fab} onPress={() => router.push('/(tabs)/shop')}>
        <Text style={s.fabText}>+ NEW QUOTE</Text>
      </Pressable>

      {/* Installer Chat Modal */}
      <Modal visible={showChat} transparent animationType="slide" onRequestClose={() => setShowChat(false)}>
        <View style={s.chatOverlay}>
          <View style={s.chatModal}>
            <View style={s.chatHeader}>
              <Text style={s.chatTitle}>💬 {selectedQuote?.installer || 'Installer'} • {selectedQuote?.name}</Text>
              <Pressable onPress={() => setShowChat(false)}><Text style={s.chatClose}>✕</Text></Pressable>
            </View>
            
            <ScrollView style={s.chatBody}>
              {chatMessages.map((msg, i) => (
                <View key={i} style={[s.chatBubble, i % 2 === 0 ? s.chatBubbleLeft : s.chatBubbleRight]}>
                  <Text style={s.chatText}>{msg}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={s.chatInputRow}>
              <Text style={s.chatInput}>Type message...</Text>
              <Pressable style={s.chatSend} onPress={sendChatMessage}>
                <Text style={s.chatSendText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F1E9' },
  content: { padding: 24, paddingBottom: 100 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#0A3D2E' },
  subtitle: { color: '#6B5B4F', fontSize: 15, marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 999, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: '#ECE4D8' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: '#0A3D2E' },
  tabText: { color: '#6B5B4F', fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#0A3D2E', marginBottom: 8 },
  emptySub: { color: '#6B5B4F', fontSize: 14, marginBottom: 24 },
  primaryBtn: { backgroundColor: '#0A3D2E', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#ECE4D8' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 17, fontWeight: '800', color: '#0A3D2E', flex: 1, paddingRight: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '800' },
  stepper: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  stepContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ECE4D8', borderWidth: 2, borderColor: '#FFFFFF' },
  stepDotActive: { backgroundColor: '#0A3D2E', borderColor: '#0A3D2E' },
  stepLine: { flex: 1, height: 3, backgroundColor: '#ECE4D8', marginHorizontal: 2 },
  stepLineActive: { backgroundColor: '#0A3D2E' },
  cardMeta: { color: '#6B5B4F', fontSize: 13, marginTop: 4 },
  installer: { color: '#0A3D2E', fontSize: 13, marginTop: 4, fontWeight: '600' },
  actionBtn: { backgroundColor: '#0A3D2E', paddingVertical: 13, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  actionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  fab: { position: 'absolute', bottom: 28, right: 20, backgroundColor: '#C5A26F', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  fabText: { color: '#0A3D2E', fontWeight: '900' },
  chatOverlay: { flex: 1, backgroundColor: 'rgba(10,61,46,0.6)', justifyContent: 'flex-end' },
  chatModal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '65%', padding: 20 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chatTitle: { fontSize: 16, fontWeight: '700', color: '#0A3D2E' },
  chatClose: { fontSize: 20, color: '#6B5B4F' },
  chatBody: { flex: 1, marginBottom: 12 },
  chatBubble: { padding: 12, borderRadius: 16, marginBottom: 8, maxWidth: '80%' },
  chatBubbleLeft: { backgroundColor: '#F8F1E9', alignSelf: 'flex-start' },
  chatBubbleRight: { backgroundColor: '#0A3D2E', alignSelf: 'flex-end' },
  chatText: { color: '#0A3D2E', fontSize: 14 },
  chatInputRow: { flexDirection: 'row', backgroundColor: '#F8F1E9', borderRadius: 999, padding: 4, alignItems: 'center' },
  chatInput: { flex: 1, paddingHorizontal: 16, color: '#6B5B4F' },
  chatSend: { backgroundColor: '#0A3D2E', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
  chatSendText: { color: '#FFFFFF', fontWeight: '800' },
});
