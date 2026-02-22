import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { FontAwesome as Icon } from '@expo/vector-icons';

const PaymentOptionsScreen = ({ navigation }) => {
  const paymentMethods = [
    { id: 1, method: 'Credit Card', icon: 'credit-card' },
    { id: 2, method: 'PayPal', icon: 'paypal' },
    { id: 3, method: 'Apple Pay', icon: 'apple' },
    { id: 4, method: 'Google Pay', icon: 'google-wallet' },
  ];
  
  const [selectedMethod, setSelectedMethod] = useState(null);

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={25} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Payment Options</Text>
        <View style={{ width: 25 }}></View>
      </View>

      <ScrollView style={styles.settingsList}>
        {paymentMethods.map(({ id, method, icon }) => (
          <TouchableOpacity 
            key={id} 
            style={styles.settingItem} 
            onPress={() => setSelectedMethod(id)}
          >
            <View style={styles.iconWithLabel}>
              <Icon name={icon} size={30} color="grey" />
              <Text style={styles.settingText}>{method}</Text>
            </View>
            {selectedMethod === id && <Icon name="check-circle" size={30} color="#3498db" />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => {
          if (selectedMethod) {
            const method = paymentMethods.find(pm => pm.id === selectedMethod)?.method;
            navigation.navigate('AddPaymentMethod', { method });
          } else {
            Alert.alert("Warning", "Please select a payment method first!");
          }
        }}
      >
        <Text style={styles.buttonText}>Add New Payment Method</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: '#3498db',
    height: 60,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  settingsList: {
    flex: 1,
    paddingHorizontal: 15,
    marginTop: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomColor: '#E0E0E0',
    borderBottomWidth: 1,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    marginVertical: 5,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  iconWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    margin: 30,
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 18,
  }
});

export default PaymentOptionsScreen;
