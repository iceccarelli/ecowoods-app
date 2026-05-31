import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function ProfileScreen() {
  const router = useRouter();
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [showRedeem, setShowRedeem] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showQuotesModal, setShowQuotesModal] = useState(false);
  const [ecoPoints] = useState(2450);
  const [user, setUser] = useState({
    name: 'James Davidson',
    location: 'Leaside, Toronto',
    email: 'james.d@ecowoods.ca',
    tier: 'Gold',
  });

  const [pendingQuotes] = useState([
    { id: 101, name: 'Solid White Oak - Natural', total: 10030, status: 'quoted', date: 'May 28' },
    { id: 104, name: 'Engineered Hickory', total: 6890, status: 'quoted', date: 'May 30' },
  ]);

  if (!isSignedIn) {
    return (
      <View style={s.screen}>
        <View style={s.unauth}>
          <View style={s.avatar}><Text style={s.avatarText}>EW</Text></View>
          <Text style={s.title}>Welcome to EcoWoods</Text>
          <Text style={s.sub}>Sign in to unlock quotes, orders, rewards & priority scheduling</Text>
          <Pressable style={s.signInBtn} onPress={() => setIsSignedIn(true)}>
            <Text style={s.signInText}>Sign in or Create Account</Text>
          </Pressable>
          <Text style={s.guestNote}>Guest checkout available • 5-year warranty still applies</Text>
        </View>
      </View>
    );
  }

  const handleRedeem = (pts: string, label: string) => {
    setShowRedeem(false);
    alert(`✅ Redeemed ${pts} pts!\n\n${label}\n\n🎁 Confirmation email sent. Your new balance: ${ecoPoints - parseInt(pts)} pts`);
  };

  const saveProfile = () => {
    setShowEditProfile(false);
    alert('✅ Profile updated! Changes saved across all devices.');
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.avatarLarge}><Text style={s.avatarLargeText}>JD</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{user.name}</Text>
          <Text style={s.meta}>{user.location} • Premium Member</Text>
          <View style={s.loyaltyBadge}><Text style={s.loyaltyText}>Gold Tier • {ecoPoints} pts</Text></View>
        </View>
        <Pressable style={s.editBtn} onPress={() => setShowEditProfile(true)}>
          <Text style={s.editText}>Edit</Text>
        </Pressable>
      </View>

      {/* EcoPoints Card - Retention Engine */}
      <View style={s.pointsCard}>
        <Text style={s.pointsTitle}>🌲 EcoPoints Balance</Text>
        <Text style={s.pointsValue}>{ecoPoints.toLocaleString()}</Text>
        <View style={s.progressBar}><View style={[s.progressFill, { width: '49%' }]} /></View>
        <Text style={s.pointsSub}>49% to Platinum • Unlock free install upgrades + priority booking</Text>
        
        <Pressable style={s.redeemBtn} onPress={() => setShowRedeem(true)}>
          <Text style={s.redeemText}>Redeem Rewards →</Text>
        </Pressable>
      </View>

      {/* Quick Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}><Text style={s.statNum}>7</Text><Text style={s.statLabel}>Projects</Text></View>
        <View style={s.statCard}><Text style={s.statNum}>4.98</Text><Text style={s.statLabel}>Avg Rating</Text></View>
        <View style={s.statCard}><Text style={s.statNum}>12</Text><Text style={s.statLabel}>Referrals</Text></View>
      </View>

      {/* Menu - Full Business Hub */}
      <View style={s.menu}>
        {[
          { icon: '📋', label: 'My Quote Requests', badge: `${pendingQuotes.length} pending`, action: () => setShowQuotesModal(true) },
          { icon: '❤️', label: 'Saved Products', badge: '7', action: () => alert('❤️ Your wishlist is synced! Tap any product in Shop to manage.') },
          { icon: '📦', label: 'Order History', action: () => router.push('/(tabs)/orders') },
          { icon: '💬', label: 'Help & Support', action: () => alert('📞 1-800-ECO-WOOD\n\nLive chat available 7am-9pm ET') },
          { icon: '🎁', label: 'Refer a Friend', badge: '+250 pts', action: () => alert('🎁 Referral link copied!\n\nYour friend gets $150 off their first install. You earn 250 pts on their purchase.') },
        ].map((item, i) => (
          <Pressable key={i} style={s.menuItem} onPress={item.action}>
            <Text style={s.menuIcon}>{item.icon}</Text>
            <Text style={s.menuLabel}>{item.label}</Text>
            {item.badge && <View style={s.badge}><Text style={s.badgeText}>{item.badge}</Text></View>}
            <Text style={s.menuArrow}>›</Text>
          </Pressable>
        ))}
      </View>

      {/* Preferences */}
      <View style={s.preferences}>
        <Text style={s.prefTitle}>Preferences</Text>
        <View style={s.prefRow}>
          <Text>Push Notifications</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ false: '#ECE4D8', true: '#0A3D2E' }} />
        </View>
        <View style={s.prefRow}>
          <Text>Email Updates</Text>
          <Switch value={true} onValueChange={() => {}} trackColor={{ false: '#ECE4D8', true: '#0A3D2E' }} />
        </View>
      </View>

      <Pressable style={s.signOutBtn} onPress={() => setIsSignedIn(false)}>
        <Text style={s.signOutText}>Sign Out</Text>
      </Pressable>

      <Text style={s.footer}>EcoWoods • Toronto • Est. 2014 • Carbon-negative since 2019</Text>

      {/* Redeem Modal */}
      <Modal visible={showRedeem} transparent onRequestClose={() => setShowRedeem(false)}>
        <View style={s.modalOverlay}>
          <View style={s.redeemModal}>
            <Text style={s.redeemTitle}>Redeem EcoPoints</Text>
            <Text style={s.redeemSub}>Choose your reward</Text>
            
            {[
              { pts: '500', label: '$50 off installation', desc: 'Applied to next project' },
              { pts: '1000', label: 'Free finish upgrade', desc: 'Premium oil or matte' },
              { pts: '2000', label: 'Priority scheduling + 10% off', desc: 'Next available slot' },
            ].map((opt, i) => (
              <Pressable key={i} style={s.redeemOption} onPress={() => handleRedeem(opt.pts, opt.label)}>
                <View>
                  <Text style={s.redeemPts}>{opt.pts} pts</Text>
                  <Text style={s.redeemLabel}>{opt.label}</Text>
                  <Text style={s.redeemDesc}>{opt.desc}</Text>
                </View>
                <Text style={s.redeemArrow}>→</Text>
              </Pressable>
            ))}
            
            <Pressable onPress={() => setShowRedeem(false)} style={{ marginTop: 16 }}>
              <Text style={{ textAlign: 'center', color: '#6B5B4F', fontWeight: '600' }}>Maybe later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <View style={s.modalOverlay}>
          <View style={s.editModal}>
            <Text style={s.modalTitle}>Edit Profile</Text>
            
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Full Name</Text>
              <TextInput style={s.formInput} value={user.name} onChangeText={(t) => setUser({...user, name: t})} />
            </View>
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Location</Text>
              <TextInput style={s.formInput} value={user.location} onChangeText={(t) => setUser({...user, location: t})} />
            </View>
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Email</Text>
              <TextInput style={s.formInput} value={user.email} onChangeText={(t) => setUser({...user, email: t})} keyboardType="email-address" />
            </View>

            <Pressable style={s.saveBtn} onPress={saveProfile}>
              <Text style={s.saveBtnText}>Save Changes</Text>
            </Pressable>
            <Pressable onPress={() => setShowEditProfile(false)} style={{ marginTop: 12 }}>
              <Text style={{ textAlign: 'center', color: '#6B5B4F' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* My Quotes Modal */}
      <Modal visible={showQuotesModal} transparent animationType="slide" onRequestClose={() => setShowQuotesModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.redeemModal, { maxHeight: '70%' }]}>
            <Text style={s.modalTitle}>My Quote Requests</Text>
            <Text style={s.redeemSub}>Active quotes • Tap to pay or message</Text>
            
            {pendingQuotes.map((q, i) => (
              <Pressable key={i} style={s.quoteItem} onPress={() => { setShowQuotesModal(false); router.push('/(tabs)/orders'); }}>
                <View>
                  <Text style={s.quoteName}>{q.name}</Text>
                  <Text style={s.quoteMeta}>{q.sqft || 500} sq ft • ${q.total} • {q.date}</Text>
                </View>
                <View style={s.quoteBadge}><Text style={s.quoteBadgeText}>PAY DEPOSIT</Text></View>
              </Pressable>
            ))}
            
            <Pressable style={s.modalSubmit} onPress={() => { setShowQuotesModal(false); router.push('/(tabs)/shop'); }}>
              <Text style={s.modalSubmitText}>+ Request New Quote</Text>
            </Pressable>
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
  guestNote: { color: '#6B5B4F', fontSize: 11, marginTop: 20, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#0A3D2E', alignItems: 'center', justifyContent: 'center' },
  avatarLargeText: { color: '#C5A26F', fontSize: 26, fontWeight: '900' },
  name: { fontSize: 22, fontWeight: '800', color: '#0A3D2E' },
  meta: { color: '#6B5B4F', fontSize: 14, marginTop: 2 },
  loyaltyBadge: { backgroundColor: '#C5A26F', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginTop: 8, alignSelf: 'flex-start' },
  loyaltyText: { color: '#0A3D2E', fontSize: 12, fontWeight: '800' },
  editBtn: { padding: 8, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#ECE4D8' },
  editText: { color: '#0A3D2E', fontWeight: '700', fontSize: 12 },
  pointsCard: { backgroundColor: '#0A3D2E', borderRadius: 20, padding: 20, marginBottom: 24 },
  pointsTitle: { color: '#C5A26F', fontSize: 14, fontWeight: '700' },
  pointsValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', marginTop: 8 },
  progressBar: { height: 8, backgroundColor: 'rgba(197,162,111,0.3)', borderRadius: 999, marginTop: 12 },
  progressFill: { height: '100%', backgroundColor: '#C5A26F', borderRadius: 999 },
  pointsSub: { color: '#D8E0DB', fontSize: 12, marginTop: 6 },
  redeemBtn: { backgroundColor: '#C5A26F', paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  redeemText: { color: '#0A3D2E', fontWeight: '800', fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#ECE4D8' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#0A3D2E' },
  statLabel: { fontSize: 11, color: '#6B5B4F', marginTop: 4 },
  menu: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#ECE4D8', marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#ECE4D8' },
  menuIcon: { fontSize: 20, marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0A3D2E' },
  badge: { backgroundColor: '#0A3D2E', paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, marginRight: 8 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  menuArrow: { color: '#C5A26F', fontSize: 20, fontWeight: '300' },
  preferences: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#ECE4D8', marginBottom: 24 },
  prefTitle: { fontSize: 15, fontWeight: '700', color: '#0A3D2E', marginBottom: 14 },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  signOutBtn: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#F8F1E9', borderWidth: 1, borderColor: '#ECE4D8' },
  signOutText: { color: '#6B5B4F', fontWeight: '700', fontSize: 15 },
  footer: { textAlign: 'center', color: '#6B5B4F', fontSize: 10, marginTop: 24, marginBottom: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,61,46,0.6)', justifyContent: 'center', padding: 24 },
  redeemModal: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 },
  redeemTitle: { fontSize: 22, fontWeight: '800', color: '#0A3D2E', textAlign: 'center', marginBottom: 8 },
  redeemSub: { color: '#6B5B4F', textAlign: 'center', marginBottom: 20 },
  redeemOption: { backgroundColor: '#F8F1E9', padding: 18, borderRadius: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  redeemPts: { color: '#C5A26F', fontWeight: '900', fontSize: 18 },
  redeemLabel: { color: '#0A3D2E', fontWeight: '700', fontSize: 15, marginTop: 4 },
  redeemDesc: { color: '#6B5B4F', fontSize: 12, marginTop: 2 },
  redeemArrow: { color: '#C5A26F', fontSize: 22 },
  editModal: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#6B5B4F', marginBottom: 6 },
  formInput: { backgroundColor: '#F8F1E9', borderWidth: 1, borderColor: '#ECE4D8', borderRadius: 12, padding: 14, fontSize: 16 },
  saveBtn: { backgroundColor: '#0A3D2E', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  quoteItem: { backgroundColor: '#F8F1E9', padding: 16, borderRadius: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteName: { fontSize: 15, fontWeight: '700', color: '#0A3D2E' },
  quoteMeta: { color: '#6B5B4F', fontSize: 12, marginTop: 4 },
  quoteBadge: { backgroundColor: '#C5A26F', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  quoteBadgeText: { color: '#0A3D2E', fontSize: 10, fontWeight: '900' },
  modalSubmit: { backgroundColor: '#0A3D2E', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  modalSubmitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
