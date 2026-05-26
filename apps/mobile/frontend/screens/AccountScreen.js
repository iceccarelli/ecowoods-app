/**
 * AccountScreen - View and edit user profile.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../context/useStore';
import api from '../services/api';
import { COLORS } from '../styles';

export default function AccountScreen({ navigation }) {
    const { user, logout } = useStore();
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    const [fullName, setFullName] = useState(user?.full_name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [address, setAddress] = useState(user?.address || '');

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.updateUser(user.id, {
                full_name: fullName || null,
                email: email || null,
                phone: phone || null,
                address: address || null,
            });
            setEditing(false);
            Alert.alert('Success', 'Profile updated successfully.');
        } catch (e) {
            Alert.alert('Error', e.message || 'Failed to update profile.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: logout },
        ]);
    };

    return (
        <ScrollView contentContainerStyle={s.scroll}>
            {/* Profile Header */}
            <View style={s.profileHeader}>
                <View style={s.avatar}>
                    <Text style={s.avatarText}>
                        {(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
                    </Text>
                </View>
                <Text style={s.profileName}>{user?.full_name || user?.username}</Text>
                <Text style={s.profileUsername}>@{user?.username}</Text>
            </View>

            {/* Profile Card */}
            <View style={s.card}>
                <View style={s.cardHeader}>
                    <Text style={s.cardTitle}>Profile Information</Text>
                    <TouchableOpacity onPress={() => setEditing(!editing)}>
                        <Ionicons
                            name={editing ? 'close-circle' : 'create-outline'}
                            size={22}
                            color={COLORS.accent}
                        />
                    </TouchableOpacity>
                </View>

                <View style={s.divider} />

                <ProfileField
                    icon="person-outline"
                    label="Full Name"
                    value={fullName}
                    editing={editing}
                    onChangeText={setFullName}
                    placeholder="Enter full name"
                />
                <ProfileField
                    icon="mail-outline"
                    label="Email"
                    value={email}
                    editing={editing}
                    onChangeText={setEmail}
                    placeholder="Enter email"
                    keyboardType="email-address"
                />
                <ProfileField
                    icon="call-outline"
                    label="Phone"
                    value={phone}
                    editing={editing}
                    onChangeText={setPhone}
                    placeholder="Enter phone number"
                    keyboardType="phone-pad"
                />
                <ProfileField
                    icon="location-outline"
                    label="Address"
                    value={address}
                    editing={editing}
                    onChangeText={setAddress}
                    placeholder="Enter address"
                />

                {editing && (
                    <TouchableOpacity
                        style={[s.saveBtn, loading && { backgroundColor: COLORS.lightGray }]}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={s.saveBtnText}>Save Changes</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Account Info */}
            <View style={s.card}>
                <Text style={s.cardTitle}>Account</Text>
                <View style={s.divider} />
                <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Username</Text>
                    <Text style={s.infoValue}>@{user?.username}</Text>
                </View>
                <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Member Since</Text>
                    <Text style={s.infoValue}>
                        {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </Text>
                </View>
                <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Status</Text>
                    <Text style={[s.infoValue, { color: COLORS.accent }]}>Active</Text>
                </View>
            </View>

            {/* Logout Button */}
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color={COLORS.red} />
                <Text style={s.logoutText}>Sign Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

function ProfileField({ icon, label, value, editing, onChangeText, placeholder, keyboardType }) {
    return (
        <View style={s.fieldRow}>
            <Ionicons name={icon} size={18} color={COLORS.textLight} style={s.fieldIcon} />
            <View style={s.fieldContent}>
                <Text style={s.fieldLabel}>{label}</Text>
                {editing ? (
                    <TextInput
                        style={s.fieldInput}
                        value={value}
                        onChangeText={onChangeText}
                        placeholder={placeholder}
                        placeholderTextColor={COLORS.gray}
                        keyboardType={keyboardType}
                        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
                    />
                ) : (
                    <Text style={s.fieldValue}>{value || 'Not set'}</Text>
                )}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    scroll: { padding: 20 },
    profileHeader: { alignItems: 'center', marginBottom: 24 },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: { fontSize: 32, fontWeight: '700', color: COLORS.white },
    profileName: { fontSize: 22, fontWeight: '700', color: COLORS.text },
    profileUsername: { fontSize: 14, color: COLORS.textLight },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
    divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 12 },
    fieldRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    fieldIcon: { marginTop: 2, marginRight: 12 },
    fieldContent: { flex: 1 },
    fieldLabel: { fontSize: 12, color: COLORS.gray, marginBottom: 2 },
    fieldValue: { fontSize: 15, color: COLORS.text },
    fieldInput: {
        backgroundColor: COLORS.offWhite,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 15,
        color: COLORS.text,
    },
    saveBtn: {
        backgroundColor: COLORS.accent,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    infoLabel: { fontSize: 14, color: COLORS.textLight },
    infoValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        marginTop: 8,
        marginBottom: 40,
    },
    logoutText: { fontSize: 16, fontWeight: '600', color: COLORS.red },
});
