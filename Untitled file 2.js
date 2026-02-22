import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

const BidTableLadenScreen: React.FC = ({ route, navigation }) => {
  const { bids } = route.params;

  const determineColor = (item) => {
    // This is a placeholder; add your logic to determine the color
    return 'green';
  };

  const renderBid = ({ item }) => (
    <View style={styles.row}>
      <Text style={styles.cell}>{item.timestamp}</Text>
      <Text style={styles.cell}>{item.bidValue}</Text>
      <Text style={styles.cell}>{item.timeframe}</Text>
      <Text style={styles.cell}>{item.pickupDate}</Text>
      <View style={[styles.cell, { backgroundColor: determineColor(item) }]}></View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bid Details</Text>
      <FlatList
        data={bids}
        renderItem={renderBid}
        keyExtractor={(item, index) => index.toString()}
        ListHeaderComponent={() => (
          <View style={styles.rowHeader}>
            <Text style={[styles.cell, styles.headerCell]}>Timestamp</Text> // Handy Marke
            <Text style={[styles.cell, styles.headerCell]}>Value</Text> // Handy Model
            <Text style={[styles.cell, styles.headerCell]}>Timeframe</Text> // Reparatur
            <Text style={[styles.cell, styles.headerCell]}>Pickup Date</Text> // Bemerkung 
            <Text style={[styles.cell, styles.headerCell]}>Status</Text> //
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F6F6F6'
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2C3E50'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E0E7FF'
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    backgroundColor: '#2980B9',
    marginBottom: 10
  },
  cell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    color: '#555',
    marginHorizontal: 5
  },
  headerCell: {
    color: '#FFF',
    fontWeight: 'bold'
  }
});

export default BidTableLadenScreen;
