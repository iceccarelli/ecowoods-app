/**
 * BidsScreen - View all bids related to the user's job requests.
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
    submitted: { bg: '#D1ECF1', text: '#0C5460' },
    accepted: { bg: '#D4EDDA', text: '#155724' },
    rejected: { bg: '#F8D7DA', text: '#721C24' },
};

export default function BidsScreen({ navigation }) {
    const { bids, bidsLoading, fetchBids } = useStore();
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchBids().catch(() => {});
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchBids();
        } catch (e) {}
        setRefreshing(false);
    };

    const renderItem = ({ item }) => {
        const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.submitted;
        return (
            <TouchableOpacity
                style={s.card}
                onPress={() => navigation.navigate('BidDetail', { bidId: item.id })}
                activeOpacity={0.7}
            >
                <View style={s.cardTop}>
                    <View>
                        <Text style={s.amount}>${parseFloat(item.amount).toLocaleString()} {item.currency}</Text>
                        <Text style={s.jobRef}>Job Request #{item.job_request_id}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[s.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
                    </View>
                </View>

                <View style={s.detailsRow}>
                    {item.timeframe && (
                        <View style={s.detailChip}>
                            <Ionicons name="time-outline" size={14} color={COLORS.textLight} />
                            <Text style={s.detailText}>{item.timeframe}</Text>
                        </View>
                    )}
                    {item.pickup_date && (
                        <View style={s.detailChip}>
                            <Ionicons name="calendar-outline" size={14} color={COLORS.textLight} />
                            <Text style={s.detailText}>{item.pickup_date}</Text>
                        </View>
                    )}
                </View>

                {item.notes && (
                    <Text style={s.notes} numberOfLines={2}>{item.notes}</Text>
                )}
            </TouchableOpacity>
        );
    };

    if (bidsLoading && bids.length === 0) {
        return (
            <View style={s.centered}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    return (
        <View style={s.container}>
            <FlatList
                data={bids}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                contentContainerStyle={s.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={s.empty}>
                        <Ionicons name="pricetag-outline" size={64} color={COLORS.lightGray} />
                        <Text style={s.emptyTitle}>No Bids Yet</Text>
                        <Text style={s.emptyText}>
                            Bids will appear here once they are submitted for your job requests.
                        </Text>
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
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    amount: { fontSize: 20, fontWeight: '700', color: COLORS.accent },
    jobRef: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgeText: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize' },
    detailsRow: { flexDirection: 'row', gap: 16, marginBottom: 6 },
    detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    detailText: { fontSize: 13, color: COLORS.textLight },
    notes: { fontSize: 13, color: COLORS.darkGray, fontStyle: 'italic', marginTop: 4 },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
    emptyText: { fontSize: 14, color: COLORS.textLight, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
});
