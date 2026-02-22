import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';

const BidTableLadenScreen: React.FC = ({ route, navigation }) => {
  const { bids, pressedButtons } = route.params;


const createTXTFile = async () => {
    let textContent = `Ecowoods Job Operation Details\n\n`;
    const tableBorder = '+------------------------+-------------------------------------------------+';

    // Table headers
    textContent += tableBorder + '\n';
    textContent += `| Description             | Determined by                                          \n`;
    textContent += tableBorder + '\n';

    // Go through each bid to add its details to the TXT file
    bids.forEach((item, index) => {
        const jobDescription = pressedButtons.map((button, idx) => `${button.buttonName} at ${button.timestamp}`).join(", ");
        const inChargeEcoMan = selectedManagers[index] || "Not assigned";

        // Add bid details in the TXT in a vertical manner
        textContent += `| Status                  | ${item.status || "Unknown"}                             \n`;
        textContent += tableBorder + '\n';
        textContent += `| Timestamp               | ${item.timestamp}                                       \n`;
        textContent += tableBorder + '\n';
        textContent += `| JOB DESCRIPTION         | ${jobDescription}                                       \n`;
        textContent += tableBorder + '\n';
        textContent += `| Amount Value            | ${item.bidValue}                                        \n`;
        textContent += tableBorder + '\n';
        textContent += `| Timeframe               | ${item.timeframe}                                       \n`;
        textContent += tableBorder + '\n';
        textContent += `| In Charge EcoMan        | ${inChargeEcoMan}                                       \n`;
        textContent += tableBorder + '\n';
        textContent += `| Start Date              | ${item.pickupDate}                                      \n`;
        textContent += tableBorder + '\n';
    });

    textContent += "\nEcowoods Report, for any other pending requests or amendments, please contact us at your.service@ecowoods.ca";

     if (Platform.OS === 'web') {
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'Print_Schedule_Row_Details.txt';
        a.click();

        URL.revokeObjectURL(url);
    } else {
        // Check for write permissions (for example, Android requires this)
        const { granted } = await FileSystem.requestPermissionsAsync();
        if (!granted) {
            Alert.alert('Error', 'Permission is required to save the file.');
            return;
        }

        const filename = `${FileSystem.documentDirectory}Print_Schedule_Row_Details.txt`;

        try {
            await FileSystem.writeAsStringAsync(filename, textContent, { encoding: FileSystem.EncodingType.UTF8 });
            Alert.alert('Success', 'TXT created at ' + filename);
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'An error occurred while creating the TXT.');
        }
    }
};

  // Use an object to store manager selections for each bid
  const [selectedManagers, setSelectedManagers] = useState({});

  const determineColor = (item) => {
    // Placeholder logic
    return 'green';
  };

  const renderBid = ({ item, index }) => (
    <View style={styles.row}>
      <View style={[styles.cell, { backgroundColor: determineColor(item) }]}></View>
      <Text style={styles.cell}>{item.timestamp}</Text>
    <Text style={styles.cell}>{pressedButtons.map((button, idx) => (
      <Text key={idx}> {idx + 1}. {button.buttonName} at {button.timestamp}</Text>
    ))}</Text>
      <Text style={styles.cell}>{item.bidValue}</Text>
      <Text style={styles.cell}>{item.timeframe}</Text>
      <Picker
        selectedValue={selectedManagers[index] || "header"}
        onValueChange={(itemValue) => {
          setSelectedManagers(prev => ({ ...prev, [index]: itemValue }));
        }}
        style={{ flex: 1 }}
      >
        <Picker.Item label="Please Select a SubManager..." value="header" enabled={false} />
        <Picker.Item label="Manager #1" value="Manager #1" />
        <Picker.Item label="Manager #2" value="Manager #2" />
        <Picker.Item label="Manager #3" value="Manager #3" />
        <Picker.Item label="Manager #4" value="Manager #4" />
        <Picker.Item label="Manager #5" value="Manager #5" />
        <Picker.Item label="Manager #6" value="Manager #6" />
        <Picker.Item label="Manager #7" value="Manager #7" />
      </Picker>
      <Text style={styles.cell}>{item.pickupDate}</Text>
      <TouchableOpacity onPress={createTXTFile}>
                <Text style={styles.hyperlinkText}>Print Schedule</Text>
            </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schedule of Job Operation Details at Ecowoods</Text>
      <FlatList
        data={bids}
        renderItem={renderBid}
        keyExtractor={(item, index) => index.toString()}
        ListHeaderComponent={() => (
          <View style={styles.rowHeader}>
           <Text style={[styles.cell, styles.headerCell]}>Status</Text>
            <Text style={[styles.cell, styles.headerCell]}>Timestamp</Text>
            <Text style={[styles.cell, styles.headerCell]}>JOB DESCROPTION</Text>
            <Text style={[styles.cell, styles.headerCell]}>Amount Value</Text>
            <Text style={[styles.cell, styles.headerCell]}>Timeframe</Text> 
            <Text style={[styles.cell, styles.headerCell]}>In Charge EcoMan</Text> 
            <Text style={[styles.cell, styles.headerCell]}>Start Date</Text>
            <Text style={[styles.cell, styles.headerCell]}>PRINT JOB ROW</Text>
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
  },
  hyperlinkText: {
        fontSize: 18,
        color: '#3498DB',
        textDecorationLine: 'underline',
        marginTop: 15,
    }
});

export default BidTableLadenScreen;
