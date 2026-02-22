import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, Platform } from 'react-native';
import { FontAwesome as Icon } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

const PlacedOrdersScreen: React.FC = ({ route, navigation }) => {
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
    timeframe
} = route.params;

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
            routes: [{ name: 'Home', params: { 
            orderDetails: details,
                    pressedButtons: pressedButtons,
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
                    timeframe: timeframe } }],
        });
    };
    const navigateToBidersladen = () => {
    navigation.navigate('Bidersladen', {
        orderDetails: orderDetails,
    
                   
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
        pressedButtons: pressedButtons.map((button, index) => ({
            buttonName: button,
            timestamp: new Date().toLocaleTimeString() // added timestamp as an example, you can replace with the actual time button was pressed
        })),
        
        screenFrom: 'PlacedOrdersScreen',
        user: 'Francisco Table To Do' // replace with the actual user's name or ID
    });
};


    const renderItem = ({ item }) => (
        <View style={styles.listItem}>
            <Text style={styles.listText}>{item}</Text>
            <TouchableOpacity onPress={() => handleThreeDotPress(item)}>
                <Text style={styles.dots}>...</Text>
            </TouchableOpacity>
        </View>
    );
const createTXTFile = () => {
    // Header and footer for the table
    const tableBorder = '+------------------------+-------------------------------------------------+';
    const header = `| Parameter              | Value                                           |\n${tableBorder}`;

    // Construct the Selected Services rows
    const servicesRows = pressedButtons.map((service, idx) => `| ${idx + 1}. Selected Service    | ${service}\n`).join('');
    
    // Construct the Additional Details row
    const detailsRow = `| Additional Details     | ${orderDetails}\n`;
    const emailRow = `| Email                  | ${passedEmail}\n`;
    const sizeRow = `| Size                   | ${size}\n`;
    const woodTypeRow = `| Wood Type              | ${woodType}\n`;
    const widthRow = `| Width                  | ${width}\n`;
    const thicknessRow = `| Thickness              | ${thickness}\n`;
    const colorRow = `| Color                  | ${color}\n`;
    const propertyTypeRow = `| Property Type          | ${propertyType}\n`;
    const homeLevelsRow = `| Home Levels            | ${homeLevels}\n`;
    const demolitionRequiredRow = `| Demolition Required   | ${demolitionRequired}\n`;
    const subfloorTypeRow = `| Subfloor Type          | ${subfloorType}\n`;
    const timeframeRow = `| Timeframe              | ${timeframe}\n`;
    
    // Construct the Radius row
    const radiusRow = `| Search Radius (km)     | ${radius}\n`;

    // Combine all rows and format the table
    let textContent = `
Ecowoods Order Details

${tableBorder}
${header}
${servicesRows}
${tableBorder}
${detailsRow}
${tableBorder}
${emailRow}
${tableBorder}
${sizeRow}
${tableBorder}
${woodTypeRow}
${tableBorder}
${widthRow}
${tableBorder}
${thicknessRow}
${tableBorder}
${colorRow}
${tableBorder}
${propertyTypeRow}
${tableBorder}
${homeLevelsRow}
${tableBorder}
${demolitionRequiredRow}
${tableBorder}
${subfloorTypeRow}
${tableBorder}
${timeframeRow}
${tableBorder}
${radiusRow}
${tableBorder}
Ecowoods Report, for any other pending requests or amendments, please contact us at your.service@ecowoods.ca
`;

    if (Platform.OS === 'web') {
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'Ecowood_Order_Details.txt';
        a.click();

        URL.revokeObjectURL(url);
    } else {
        const filename = `${FileSystem.documentDirectory}Ecowood_Order_Details.txt`;

        try {
            FileSystem.writeAsStringAsync(filename, textContent, { encoding: FileSystem.EncodingType.UTF8 });
            Alert.alert('Success', 'TXT created at ' + filename);
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'An error occurred while creating the TXT.');
        }
    }
};

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Placed Orders</Text>
            <Text style={styles.title}>To be Processed at Ecowoods:</Text>
                {pressedButtons.map((button, index) => (
                <Text key={index}> {index + 1}. {button}</Text>))}
                
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
                data={route.params}
                renderItem={renderItem}
                keyExtractor={(item, index) => `button-${index}`}
                style={styles.flatlist}
            />

            <View style={styles.listItem}>
                <Text style={styles.orderText}>Your order of {orderDetails} is being processed.</Text>
                <TouchableOpacity onPress={() => handleThreeDotPress(orderDetails)}>
                    <Text style={styles.dots}>...</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.homeButton} onPress={navigateToHome}>
                <Icon name="home" size={24} color="#FFF" />
                <Text style={styles.homeButtonText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeButton} onPress={navigateToBidersladen}>
                <Icon name="wrench" size={24} color="#FFF" />
                <Text style={styles.homeButtonText}>Ecowood Overview</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={createTXTFile}>
                <Text style={styles.hyperlinkText}>As Client: Save as TXT</Text>
            </TouchableOpacity>
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
        marginBottom: 20,
        color: '#2C3E50' // changed for a more appealing look
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

export default PlacedOrdersScreen;
