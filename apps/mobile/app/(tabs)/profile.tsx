import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function ProfileScreen() {
  const router = useRouter();
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [showRedeem, setShowRedeem] = useState(false);
  const [ecoPoints] = useState(2450);

  if (!isSignedIn) {
    return (
      <View style={s.screen}>
        <View style={s.unauth}>
          <View style={s.avatar}><Text style={s.avatarText}>EW</Text></View>
          <Text style={s.title}>Welcome to EcoWoods</Text>
          <Text style={s.sub}>Sign in to unlock quotes, orders & rewards</Text>
          <Pressable style={s.signInBtn} onPress={() => setIsSignedIn(true)}>
            <Text style={s.signInText}>Sign in or Create Account</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.avatarLarge}><Text style={s.avatarLargeText}>JD</Text></View>
        <View>
          <Text style={s.name}>James Davidson</Text>
          <Text style={s.meta}>Premium Member • Leaside, Toronto</Text>
          <View style={s.loyaltyBadge}><Text style={s.loyaltyText}>Gold Tier • {ecoPoints} pts</Text></View>
        </View>
      </View>

      <View style={s.pointsCard}>
        <Text style={s.pointsTitle}>🌲 EcoPoints Balance</Text>
        <Text style={s.pointsValue}>{ecoPoints.toLocaleString()}</Text>
        <View style={s.progressBar}><View style={[s.progressFill, { width: '49%' }]} /></View>
        <Text style={s.pointsSub}>49% to Platinum</Text>
        <Pressable style={s.redeemBtn} onPress={() => setShowRedeem(true)}>
          <Text style={s.redeemText}>Redeem Rewards</Text>
        </Pressable>
      </View>

      <View style={s.menu}>
        {[
          { icon: '📋', label: 'My Quote Requests', badge: '2 pending' },
          { icon: '❤️', label: 'Saved Products', badge: '7' },
          { icon: '📦', label: 'Order History' },
          { icon: '💬', label: 'Help & Support' },
        ].map((item, i) => (
          <Pressable key={i} style={s.menuItem}>
            <Text style={s.menuIcon}>{item.icon}</Text>
            <Text style={s.menuLabel}>{item.label}</Text>
            {item.badge && <View style={s.badge}><Text style={s.badgeText}>{item.badge}</Text></View>}
          </Pressable>
        ))}
      </View>

      <View style={s.preferences}>
        <Text style={s.prefTitle}>Preferences</Text>
        <View style={s.prefRow}>
          <Text>Push Notifications</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>
      </View>

      <Pressable style={s.signOutBtn} onPress={() => setIsSignedIn(false)}>
        <Text style={s.signOutText}>Sign Out</Text>
      </Pressable>

      <Modal visible={showRedeem} transparent onRequestClose={() => setShowRedeem(false)}>
        <View style={s.modalOverlay}>
          <View style={s.redeemModal}>
            <Text style={s.redeemTitle}>Redeem EcoPoints</Text>
            {[
              { pts: '500', label: '$50 off installation' },
              { pts: '1000', label: 'Free finish upgrade' },
              { pts: '2000', label: 'Priority scheduling + 10% off' },
            ].map((opt, i) => (
              <Pressable key={i} style={s.redeemOption} onPress={() => { setShowRedeem(false); alert(`✅ Redeemed ${opt.pts} pts!`); }}>
                <Text style={s.redeemPts}>{opt.pts} pts</Text>
                <Text style={s.redeemLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F1E9' },
  content: { padding: 24 },
  unauth: { alignItems: 'center', paddingTop: 80 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#0A3D2E', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  avatarText: { color: '#C5A26F', fontSize: 28, fontWeight: '900' },
  title: { fontSize: 26, fontWeight: '800', color: '#0A3D2E' },
  sub: { color: '#6B5B4F', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  signInBtn: { backgroundColor: '#0A3D2E', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 16 },
  signInText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#0A3D2E', alignItems: 'center', justifyContent: 'center' },
  avatarLargeText: { color: '#C5A26F', fontSize: 26, fontWeight: '900' },
  name: { fontSize: 22, fontWeight: '800', color: '#0A3D2E' },
  meta: { color: '#6B5B4F', fontSize: 14, marginTop: 2 },
  loyaltyBadge: { backgroundColor: '#C5A26F', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginTop: 8, alignSelf: 'flex-start' },
  loyaltyText: { color: '#0A3D2E', fontSize: 12, fontWeight: '800' },
  pointsCard: { backgroundColor: '#0A3D2E', borderRadius: 20, padding: 20, marginBottom: 24 },
  pointsTitle: { color: '#C5A26F', fontSize: 14, fontWeight: '700' },
  pointsValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', marginTop: 8 },
  progressBar: { height: 8, backgroundColor: 'rgba(197,162,111,0.3)', borderRadius: 999, marginTop: 12 },
  progressFill: { height: '100%', backgroundColor: '#C5A26F', borderRadius: 999 },
  pointsSub: { color: '#D8E0DB', fontSize: 12, marginTop: 6 },
  redeemBtn: { backgroundColor: '#C5A26F', paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  redeemText: { color: '#0A3D2E', fontWeight: '800', fontSize: 15 },
  menu: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#ECE4D8', marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#ECE4D8' },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0A3D2E' },
  badge: { backgroundColor: '#0A3D2E', paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  preferences: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#ECE4D8', marginBottom: 24 },
  prefTitle: { fontSize: 15, fontWeight: '700', color: '#0A3D2E', marginBottom: 14 },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  signOutBtn: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#F8F1E9', borderWidth: 1, borderColor: '#ECE4D8' },
  signOutText: { color: '#6B5B4F', fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,61,46,0.6)', justifyContent: 'center', padding: 24 },
  redeemModal: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 },
  redeemTitle: { fontSize: 22, fontWeight: '800', color: '#0A3D2E', textAlign: 'center', marginBottom: 20 },
  redeemOption: { backgroundColor: '#F8F1E9', padding: 18, borderRadius: 16, marginBottom: 10 },
  redeemPts: { color: '#C5A26F', fontWeight: '900', fontSize: 18 },
  redeemLabel: { color: '#0A3D2E', fontWeight: '700', fontSize: 15, marginTop: 4 },
});
