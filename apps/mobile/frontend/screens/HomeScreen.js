/**
 * HomeScreen - Main dashboard with navigation cards.
 */

import React, { useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Platform,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

const MENU_ITEMS = [
    {
        key: 'JobRequest',
        title: 'New Job Request',
        subtitle: 'Request hardwood flooring services',
        icon: 'add-circle',
        color: COLORS.accent,
    },
    {
        key: 'PlacedOrders',
        title: 'My Job Requests',
        subtitle: 'View submitted requests & status',
        icon: 'clipboard',
        color: COLORS.blue,
    },
    {
        key: 'Bids',
        title: 'Bids',
        subtitle: 'View and manage bids',
        icon: 'pricetag',
        color: COLORS.orange,
    },
    {
        key: 'Calendar',
        title: 'Calendar',
        subtitle: 'Scheduled jobs & events',
        icon: 'calendar',
        color: '#8E44AD',
    },
    {
        key: 'Account',
        title: 'My Account',
        subtitle: 'Profile & settings',
        icon: 'person-circle',
        color: COLORS.primaryLight,
    },
];

export default function HomeScreen({ navigation }) {
    const { user, logout, fetchJobRequests, fetchBids, jobRequests, bids } = useStore();
    const [refreshing, setRefreshing] = React.useState(false);

    useEffect(() => {
        fetchJobRequests().catch(() => {});
        fetchBids().catch(() => {});
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([fetchJobRequests(), fetchBids()]);
        } catch (e) {}
        setRefreshing(false);
    };

    const pendingJobs = jobRequests.filter((j) => j.status === 'pending').length;
    const activeBids = bids.filter((b) => b.status === 'submitted').length;

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View style={s.headerTop}>
                    <View>
                        <Text style={s.greeting}>Welcome back,</Text>
                        <Text style={s.userName}>{user?.full_name || user?.username || 'User'}</Text>
                    </View>
                    <TouchableOpacity onPress={logout} style={s.logoutBtn}>
                        <Ionicons name="log-out-outline" size={24} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                </View>

                {/* Quick Stats */}
                <View style={s.statsRow}>
                    <View style={s.statCard}>
                        <Text style={s.statNumber}>{jobRequests.length}</Text>
                        <Text style={s.statLabel}>Requests</Text>
                    </View>
                    <View style={s.statCard}>
                        <Text style={s.statNumber}>{pendingJobs}</Text>
                        <Text style={s.statLabel}>Pending</Text>
                    </View>
                    <View style={s.statCard}>
                        <Text style={s.statNumber}>{bids.length}</Text>
                        <Text style={s.statLabel}>Bids</Text>
                    </View>
                    <View style={s.statCard}>
                        <Text style={s.statNumber}>{activeBids}</Text>
                        <Text style={s.statLabel}>Active</Text>
                    </View>
                </View>
            </View>

            {/* Menu Grid */}
            <ScrollView
                contentContainerStyle={s.menuContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {MENU_ITEMS.map((item) => (
                    <TouchableOpacity
                        key={item.key}
                        style={s.menuCard}
                        onPress={() => navigation.navigate(item.key)}
                        activeOpacity={0.7}
                    >
                        <View style={[s.menuIcon, { backgroundColor: item.color + '15' }]}>
                            <Ionicons name={item.icon} size={28} color={item.color} />
                        </View>
                        <View style={s.menuTextContainer}>
                            <Text style={s.menuTitle}>{item.title}</Text>
                            <Text style={s.menuSubtitle}>{item.subtitle}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.lightGray} />
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.offWhite,
    },
    header: {
        backgroundColor: COLORS.primary,
        paddingTop: Platform.OS === 'ios' ? 56 : 44,
        paddingHorizontal: 20,
        paddingBottom: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    greeting: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
    },
    userName: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.white,
    },
    logoutBtn: {
        padding: 8,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statCard: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 4,
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.white,
    },
    statLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 2,
    },
    menuContainer: {
        padding: 20,
    },
    menuCard: {
        backgroundColor: COLORS.white,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    menuIcon: {
        width: 50,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    menuTextContainer: {
        flex: 1,
    },
    menuTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
    },
    menuSubtitle: {
        fontSize: 13,
        color: COLORS.textLight,
        marginTop: 2,
    },
});
