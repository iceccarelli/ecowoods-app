import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, Platform } from 'react-native';
import { FontAwesome as Icon } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

const PlacedOrdersScreen: React.FC = ({ route, navigation }) => {
    const { orderDetails, pressedButtons,radius } = route.params;

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
    const navigateToBidersladen = () => {
    navigation.navigate('Bidersladen', {
        orderDetails: orderDetails,
        pressedButtons: pressedButtons.map((button, index) => ({
            buttonName: button,
            timestamp: new Date().toLocaleTimeString() // added timestamp as an example, you can replace with the actual time button was pressed
        })),
        radius: radius,
        screenFrom: 'PlacedOrdersScreen',
        user: 'JohnDoe' // replace with the actual user's name or ID
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
    

    // Construct the Radius row
    const radiusRow = `| Search Radius (km)     | ${radius}\n`;

    // Combine all rows and format the table
    let textContent = `
Buzzer Order Details

${tableBorder}
${header}
${servicesRows}
${tableBorder}
${detailsRow}
${tableBorder}
${radiusRow}
${tableBorder}
`;

    if (Platform.OS === 'web') {
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'Buzzer_Order.txt';
        a.click();

        URL.revokeObjectURL(url);
    } else {
        const filename = `${FileSystem.documentDirectory}Buzzer_Order.txt`;

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
            <Text style={styles.subtitle}>You Buzz within {radius}km for:</Text>

            <FlatList
                data={pressedButtons}
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
                <Text style={styles.homeButtonText}>Biders-Laden</Text>
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
