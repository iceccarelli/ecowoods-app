import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Button, TouchableOpacity, Image, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Permissions from 'expo-permissions';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { Calendar } from 'react-native-calendars';
import Icon from 'react-native-vector-icons/FontAwesome'; // Example using FontAwesome icons
import { Alert } from 'react-native';



const Bidersladen: React.FC = ({ route, navigation }) => {


  const {
    orderDetails,
    details,
    pressedButtons,
    passedEmail,
    radius,
    email,
    size,
    woodType,
    width,
    thickness,
    color,
    propertyType,
    homeLevels,
    demolitionRequired,
    subfloorType,
    screenFrom, 
    user
  } = route.params;

  const orderInfo = [
    { label: 'Order', value: orderDetails },
    { label: 'From', value: screenFrom },
    { label: 'Order by', value: user },
    { label: 'Email', value: passedEmail },
    { label: 'Size', value: size },
    { label: 'Wood Type', value: woodType },
    { label: 'Width', value: width },
    { label: 'Thickness', value: thickness },
    { label: 'Color', value: color },
    { label: 'Property Type', value: propertyType },
    { label: 'Home Levels', value: homeLevels },
    { label: 'Demolition Required', value: demolitionRequired },
    { label: 'Subfloor Type', value: subfloorType },
    // ... add other parameters here
  ];
    const { showActionSheetWithOptions } = useActionSheet();
    const [bids, setBids] = useState([]);

    const currentDate = new Date().toISOString().split('T')[0];
    const handleDayPress = (day) => {
        setPickupDate(new Date(day.dateString));
    };

    const [timeframe, setTimeframe] = useState(null);
    const [cost, setCost] = useState(null);
    const [pickupDate, setPickupDate] = useState(null);
    const [showDateTimePicker, setShowDateTimePicker] = useState(false);

    const renderBidItem = ({ item }) => (
        <View style={styles.bidItem}>
            <Text style={styles.bidText}>{item.timestamp}</Text>
            <Text style={styles.bidText}>{item.bidder}</Text>
            <Text style={styles.bidText}>{item.bidValue}</Text>
        </View>
    );
    const handleThreeDotPress = (item) => {
        Alert.alert(
            `Actions for ${item}`,
            "Choose an action",
            [
                { text: "Make Change", onPress: () => console.log(`Make Change pressed for ${item}`) },
                { text: "Delete", onPress: () => console.log(`Delete pressed for ${item}`) },
                { text: "Submit Again", onPress: () => console.log(`Submit Again pressed for ${item}`) }
            ],
            { cancelable: true }
        );
    };

    const navigateToHome = () => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'Home', params: { orderDetails: orderDetails, pressedButtons: pressedButtons } }],
        });
    };



//fix this tonight so that the table shows up!


    const handleBidSubmission = () => {
    const bidData = {
        timestamp: new Date().toLocaleTimeString(),
        bidValue: cost,
        timeframe: timeframe,
        pickupDate: pickupDate ? pickupDate.toISOString().split('T')[0] : 'Not selected'
    };

    setBids(prevBids => [...prevBids, bidData]);

    navigation.navigate('BidTableLadenScreen', {
      bids: [...bids, bidData],
      pressedButtons: pressedButtons,
      orderDetails: details,
                   
                    radius: radius,  // If the radius is not declared earlier in your component, this will be undefined.
                    email: passedEmail,
                    size: size,
                    woodType: woodType,
                    width: width,
                    thickness: thickness,
                    color: color,
                    propertyType: propertyType,
                    homeLevels: homeLevels,
                    demolitionRequired: demolitionRequired,
                    subfloorType: subfloorType,
                    timeframe: timeframe,
        
        pressedButtons: pressedButtons.map(button => ({
    buttonName: button.buttonName || button,
    timestamp: button.timestamp || new Date().toLocaleTimeString()
})),
        timestamp: bidData.timestamp,
        bidValue: bidData.bidValue,
        timeframe: bidData.timeframe,
        pickupDate: bidData.pickupDate
    });
};

const renderItem = ({ item }) => (
    <View style={styles.listItem}>
        <Text style={styles.listText}>{item.label}: {item.value}</Text>
        <TouchableOpacity onPress={() => handleThreeDotPress(item.label)}>
            <Text style={styles.dots}>...</Text>
        </TouchableOpacity>
    </View>
);


    const createTXTFile = async () => {
    // Assuming idx is 1 for now
    const idx = 1;
    // Header and footer for the table
    const tableBorder = '+------------------------+-------------------------------------------------+';
    const header = `| Parameter              | Value                                           |\n${tableBorder}`;

    // Construct the Selected Services rows
    const timeframeservicesRows =  `| ${idx + 1}. Bid Timeframe    : ${timeframe}\n`;
    // Construct the Additional Details row
    const costdetailsRow = `| Additional Details in €: ${cost}\n`;
    

    // Construct the Radius row
    const pickupDateRow = `| Bid Pickup Time Approx     : ${pickupDate ? pickupDate.toISOString().split('T')[0] : 'Not selected'}\n`;

    // Combine all rows and format the table
    let textContent = `
Buzzer Order Details

${tableBorder}
${header}
${timeframeservicesRows}
${tableBorder}
${costdetailsRow}
${tableBorder}
${pickupDateRow}
${tableBorder}
`;

    if (Platform.OS === 'web') {
            const blob = new Blob([textContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Bid_for_Buzzer_Order.txt';
            a.click();
            URL.revokeObjectURL(url);
        } else {
            // Check for permissions and ask if necessary
            const { status } = await Permissions.askAsync(Permissions.WRITE_EXTERNAL_STORAGE);
            if (status !== 'granted') {
                Alert.alert('Permission not granted', 'Unable to save file without storage permissions.');
                return;
            }

            const filename = `${FileSystem.documentDirectory}Bid_for_Buzzer_Order.txt`;

            try {
                await FileSystem.writeAsStringAsync(filename, textContent, { encoding: FileSystem.EncodingType.UTF8 });
                Alert.alert('Success', 'TXT created at ' + filename);
            } catch (err) {
                console.error(err);
                Alert.alert('Error', 'An error occurred while creating the TXT.');
            }
        }
    };
    
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ecowood Transfer for: {orderDetails}</Text>
            <Text style={styles.subtitle}>From: {screenFrom}</Text>
            <Text style={styles.subtitle}>Order by: {user}</Text>

            <Picker
                selectedValue={timeframe}
                onValueChange={(itemValue) => setTimeframe(itemValue)}
                style={{ height: 50, width: '100%', marginBottom: 10 }}
            >
                <Picker.Item label="Select Timeframe" value={null} />
                <Picker.Item label="Within 24h" value="24h" />
                <Picker.Item label="2-3 days" value="2-3days" />
                <Picker.Item label="3-7 days" value="3-7days" />
                <Picker.Item label="More than 1 week" value="1week+" />
            </Picker>


            <Picker
    selectedValue={cost}
    onValueChange={(itemValue) => setCost(itemValue)}
    style={{ height: 50, width: '100%', marginBottom: 10 }}
>
    <Picker.Item label="Select Cost" value={null} />
    <Picker.Item label="About €500" value="500" />
    <Picker.Item label="About €1000" value="1000" />
    <Picker.Item label="About €1500" value="1500" />
    <Picker.Item label="About €2000" value="2000" />
    <Picker.Item label="About €2500" value="2500" />
    <Picker.Item label="About €3000" value="3000" />
<Picker.Item label="About €3500" value="3500" />
<Picker.Item label="About €4000" value="4000" />
<Picker.Item label="About €4500" value="4500" />
<Picker.Item label="About €5000" value="5000" />
<Picker.Item label="About €5500" value="5500" />
<Picker.Item label="About €6000" value="6000" />
<Picker.Item label="About €6500" value="6500" />
<Picker.Item label="About €7000" value="7000" />
<Picker.Item label="About €7500" value="7500" />
<Picker.Item label="About €8000" value="8000" />
<Picker.Item label="About €8500" value="8500" />
<Picker.Item label="About €9000" value="9000" />
<Picker.Item label="About €9500" value="9500" />
<Picker.Item label="About €10000" value="10000" />
<Picker.Item label="About €10500" value="10500" />
<Picker.Item label="About €11000" value="11000" />
<Picker.Item label="About €11500" value="11500" />
<Picker.Item label="About €12000" value="12000" />
<Picker.Item label="About €12500" value="12500" />
<Picker.Item label="About €13000" value="13000" />
<Picker.Item label="About €13500" value="13500" />
<Picker.Item label="About €14000" value="14000" />
<Picker.Item label="About €14500" value="14500" />
<Picker.Item label="About €15000" value="15000" />
<Picker.Item label="About €15500" value="15500" />
<Picker.Item label="About €16000" value="16000" />
<Picker.Item label="About €16500" value="16500" />
<Picker.Item label="About €17000" value="17000" />
<Picker.Item label="About €17500" value="17500" />
<Picker.Item label="About €18000" value="18000" />
<Picker.Item label="About €18500" value="18500" />
<Picker.Item label="About €19000" value="19000" />
<Picker.Item label="About €19500" value="19500" />
<Picker.Item label="About €20000" value="20000" />

</Picker>
<Text>Select Pickup Date:</Text>
<Calendar
    onDayPress={handleDayPress}
    minDate={currentDate}
    markedDates={{
        [pickupDate ? pickupDate.toISOString().split('T')[0] : '']: {
            selected: true,
            selectedColor: '#2C3E50'
        }
    }}
/>
            
{pickupDate && <Text>{pickupDate.toISOString().split('T')[0]}</Text>}

{/* Display the user's selections */}
<View style={styles.selectionContainer}>
    <Text>Selected Timeframe: {timeframe}</Text>
    <Text>Selected Cost: €{cost}</Text>
    <Text>Selected Pickup Date: {pickupDate ? pickupDate.toISOString().split('T')[0] : 'Not selected'}</Text>
</View>

        <Text style={styles.subtitle}>Ecowood Will handle:</Text>
        <Text style={styles.title}>To be Processed at Ecowoods:</Text>
                {pressedButtons.map((button, index) => (
    <Text key={index}> {index + 1}. {button.buttonName} at {button.timestamp}</Text>
))}

                
                <Text style={{ marginTop: 10, fontSize: 16 }}>Additional Details:</Text>
                <Text>{details}</Text>  {/* Show the user-entered details */}
                
                {/* Display other retrieved details */}
                <Text>Email: {passedEmail}</Text>
                <Text>Size: {size}</Text>
                <Text>Wood Type: {woodType}</Text>
                <Text>Width: {width}</Text>
                <Text>Thickness: {thickness}</Text>
                <Text>Color: {color}</Text>
                <Text>Property Type: {propertyType}</Text>
                <Text>Home Levels: {homeLevels}</Text>
                <Text>Demolition Required: {demolitionRequired}</Text>
                <Text>Subfloor Type: {subfloorType}</Text>
                <Text>Timeframe: {timeframe}</Text>
            <Text style={styles.subtitle}>You Buzz within {radius}km for:</Text>

            
        <FlatList
    data={orderInfo}
    renderItem={renderItem}
    keyExtractor={(item, index) => `detail-${index}`}
/>


        
        <Text style={styles.subtitle}>Bids:</Text>
        <FlatList
            data={[]}  // You can populate this
            renderItem={renderBidItem}
            keyExtractor={(item, index) => `bid-${index}`}
            ListHeaderComponent={() => (
              <View style={styles.container}>
                <View style={styles.bidHeader}>
                    <Text style={styles.headerText}>Timestamp</Text>
                    <Text style={styles.headerText}>Bidder</Text>
                    <Text style={styles.headerText}>Bid Value</Text>
                </View>
                    <TouchableOpacity style={styles.homeButton} onPress={navigateToHome}>
                <Icon name="home" size={24} color="#FFF" />
                <Text style={styles.homeButtonText}>Home</Text>
            </TouchableOpacity>
            
<TouchableOpacity style={styles.homeButton} onPress={handleBidSubmission}>
    <Icon name="laptop" size={24} color="#FFF" />
    <Text style={styles.homeButtonText}>Submit to JOBS TIMETABLE</Text>
</TouchableOpacity>
            <TouchableOpacity onPress={createTXTFile}>
                <Text style={styles.hyperlinkText}>As Bid: Save as TXT</Text>
            </TouchableOpacity>
            
                </View>
            )}
        />
    </View>
);
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#F6F6F6',
        alignItems: 'center'
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
        color: '#2C3E50'
    },
    subtitle: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 10,
        color: '#34495E'
    },
    listText: {
        fontSize: 18,
        color: '#555',
        marginBottom: 5
    },
    bidItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        marginVertical: 10,
        borderRadius: 10,
        backgroundColor: '#ECF0F1'
    },
    bidText: {
        fontSize: 20,
        color: '#555'
    },
    bidHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        marginVertical: 10,
        borderBottomWidth: 2,
        borderColor: '#2980B9'
    },
    headerText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#34495E'
    },
    selectionContainer: {
        padding: 15,
        marginVertical: 10,
        borderRadius: 10,
        backgroundColor: '#E0E7FF'
    },
    subtitle: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 20,
        color: '#34495E'
    },
    orderText: {
        fontSize: 20,
        color: '#777'
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 10,
        marginVertical: 10,
        width: '100%',
        borderRadius: 10,
        backgroundColor: '#ECF0F1'
    },
    listText: {
        fontSize: 20,
        color: '#555'
    },
    dots: {
        fontSize: 28,
        color: '#7F8C8D'
    },
    flatlist: {
        width: '100%'
    },
    homeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2980B9', // more vibrant blue
        padding: 15,
        borderRadius: 35,
        marginTop: 20,
    },
    homeButtonText: {
        color: '#FFF',
        marginLeft: 15,
        fontSize: 20,
        fontWeight: 'bold'
    },
    hyperlinkText: {
        fontSize: 18,
        color: '#3498DB',
        textDecorationLine: 'underline',
        marginTop: 15,
    }
});

export default Bidersladen;
