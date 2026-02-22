import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { Alert } from 'react-native';
import { Calendar, Agenda } from 'react-native-calendars';

export default function CalendarScreen() {
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [theme, setTheme] = useState('light');
    const [items, setItems] = useState({});
    const [newItem, setNewItem] = useState("");

    const currentDate = new Date().toISOString().split('T')[0];
    const [addedItems, setAddedItems] = useState([]);

    const addNewItem = () => {
        if (!newItem.trim()) {
            Alert.alert("Error", "Item cannot be empty!");
            return;
        }

        setAddedItems(prevItems => [...prevItems, newItem]);
        setNewItem("");
        Alert.alert("Success", "Item added successfully!");
    };

    const handleDayPress = (day) => {
        if (!fromDate) {
            setFromDate(day.dateString);
            setToDate(null);
        } else if (!toDate) {
            if (day.dateString < fromDate) {
                setToDate(fromDate);
                setFromDate(day.dateString);
            } else {
                setToDate(day.dateString);
            }
        } else {
            setFromDate(day.dateString);
            setToDate(null);
        }
    };
    const sendNewItemToClient = () => {
    // Bundle the dates and items together
    const dataToSend = {
        fromDate: fromDate,
        toDate: toDate,
        items: addedItems,
    };

    // Here you can send the data to your backend or another service.
    // For the sake of this example, I'll console.log the data.
    console.log("Sending the following data to the client:", dataToSend);

    // Optionally, clear the added items after sending
    // setAddedItems([]);
};

    const confirmAddItem = () => {
    Alert.alert(
      "Add Item",
      "Are you sure you want to add this item?",
      [
        {
          text: "Cancel",
          onPress: () => console.log("Cancelled"),
          style: "cancel"
        },
        { text: "Add", onPress: addNewItem }
      ]
    );
  };
  const renderItem = (item, firstItemInDay) => (
  <View style={[styles.item, { height: item.height }]}>
    <Text>{item.name}</Text>
    <TouchableOpacity onPress={() => deleteItem(selectedDate, item.name)}>
      <Text style={{ color: 'red' }}>Delete</Text>
    </TouchableOpacity>
  </View>
);

    const generateMarkedDates = () => {
        let dates = {};

        if (fromDate) {
            dates[fromDate] = { selected: true, startingDay: true, color: '#2C3E50' };
        }

        if (toDate) {
            dates[toDate] = { ...dates[toDate], selected: true, endingDay: true, color: '#2C3E50' };
        }

        let currentDate = fromDate;
        while (currentDate && toDate && currentDate !== toDate) {
            currentDate = new Date(new Date(currentDate).setDate(new Date(currentDate).getDate() + 1)).toISOString().split('T')[0];
            dates[currentDate] = { selected: true, color: '#AED6F1' };
        }

        return dates;
    };

     return (
        <View style={styles.container}>
            <Text style={styles.header}>Ecowoods Calendar</Text>
            

            <Calendar
                onDayPress={handleDayPress}
                minDate={currentDate}
                markedDates={generateMarkedDates()}
            />
            <Text style={styles.subHeader}>From: {fromDate || "N/A"}</Text>
            <Text style={styles.subHeader}>To: {toDate || "N/A"}</Text>

            {addedItems.map((item, index) => (
    <Text key={index} style={styles.addedItemText}>{index + 1}. {item}</Text>
))}

            <TextInput
                style={styles.input}
                value={newItem}
                onChangeText={setNewItem}
                placeholder="Add a new item..."
            />
            <TouchableOpacity style={styles.button} onPress={addNewItem}>
                <Text style={styles.buttonText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={sendNewItemToClient}>
                <Text style={styles.buttonText}>Send information</Text>
            </TouchableOpacity>

        </View>
            );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 15,
  },
  day: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  item: {
    backgroundColor: 'lightgray',
    flex: 1,
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    marginTop: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    backgroundColor: '#fff',
    padding: 10,
    marginTop: 15,
    borderRadius: 5,
    fontSize: 16,
  },
  button: {
    marginTop: 10,
    backgroundColor: '#3498db',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addedItemText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 10,
    marginLeft: 10,
    color: '#222',
},
  emptyDate: {
  justifyContent: 'center',
  alignItems: 'center',
  padding: 10,
  backgroundColor: '#e9e9e9',
  borderBottomWidth: 1,
  borderBottomColor: '#E0E0E0',
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  subHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
    color: '#555',
  }
});

