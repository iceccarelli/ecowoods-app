/**
 * PlacedOrdersScreen - View all submitted job requests.
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

const STATUS_COLORS = {
    pending: { bg: '#FFF3CD', text: '#856404' },
    estimated: { bg: '#D1ECF1', text: '#0C5460' },
    in_progress: { bg: '#CCE5FF', text: '#004085' },
    completed: { bg: '#D4EDDA', text: '#155724' },
    cancelled: { bg: '#F8D7DA', text: '#721C24' },
};

export default function PlacedOrdersScreen({ navigation }) {
    const { jobRequests, jobRequestsLoading, fetchJobRequests } = useStore();
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchJobRequests().catch(() => {});
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchJobRequests();
        } catch (e) {}
        setRefreshing(false);
    };

    const renderItem = ({ item }) => {
        const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
        return (
            <TouchableOpacity
                style={s.card}
                onPress={() => navigation.navigate('RequestEstimate', { jobId: item.id })}
                activeOpacity={0.7}
            >
                <View style={s.cardTop}>
                    <View>
                        <Text style={s.cardId}>Job #{item.id}</Text>
                        <Text style={s.cardDate}>
                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                        </Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[s.badgeText, { color: statusStyle.text }]}>
                            {(item.status || 'pending').replace('_', ' ')}
                        </Text>
                    </View>
                </View>

                {item.services && item.services.length > 0 && (
                    <Text style={s.services} numberOfLines={2}>
                        {item.services.join(' · ')}
                    </Text>
                )}

                <View style={s.cardBottom}>
                    <View style={s.detailChip}>
                        {item.wood_type && (
                            <Text style={s.chipText}>
                                <Ionicons name="leaf-outline" size={12} color={COLORS.textLight} /> {item.wood_type}
                            </Text>
                        )}
                    </View>
                    {item.size && <Text style={s.chipText}>{item.size} sq ft</Text>}
                    <Ionicons name="chevron-forward" size={18} color={COLORS.lightGray} />
                </View>
            </TouchableOpacity>
        );
    };

    if (jobRequestsLoading && jobRequests.length === 0) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    return (
        <View style={s.container}>
            <FlatList
                data={jobRequests}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                contentContainerStyle={s.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={s.empty}>
                        <Ionicons name="clipboard-outline" size={64} color={COLORS.lightGray} />
                        <Text style={s.emptyTitle}>No Job Requests Yet</Text>
                        <Text style={s.emptyText}>Create your first job request to get started.</Text>
                        <TouchableOpacity
                            style={s.createBtn}
                            onPress={() => navigation.navigate('JobRequest')}
                        >
                            <Ionicons name="add-circle" size={20} color={COLORS.white} />
                            <Text style={s.createBtnText}>New Job Request</Text>
                        </TouchableOpacity>
                    </View>
                }
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.offWhite },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16 },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    cardId: { fontSize: 16, fontWeight: '600', color: COLORS.text },
    cardDate: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgeText: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize' },
    services: { fontSize: 14, color: COLORS.textLight, marginBottom: 10 },
    cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    detailChip: { flexDirection: 'row', gap: 12 },
    chipText: { fontSize: 13, color: COLORS.textLight },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
    emptyText: { fontSize: 14, color: COLORS.textLight, marginTop: 4, textAlign: 'center' },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 20,
        gap: 8,
    },
    createBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
});
