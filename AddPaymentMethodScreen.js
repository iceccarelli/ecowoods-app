import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import styles from './styles';

const AddPaymentMethodScreen = ({ route }) => {
  const method = route?.params?.method || "";

  if (method === 'Credit Card') {
    return <CreditCardForm />;
  } else if (method === 'PayPal') {
    return <PayPalAuthentication />;
  } else if (method === 'Apple Pay') {
    return <ApplePayAuthentication />;
  } else if (method === 'Google Pay') {
    return <GooglePayAuthentication />;
  } else {
    return <DefaultPaymentScreen />;
  }
};

const CreditCardForm = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Add Credit Card</Text>
    <Text style={styles.label}>Card Number</Text>
    <TextInput style={styles.input} keyboardType="number-pad" />
    <Text style={styles.label}>Expiry Date</Text>
    <TextInput style={styles.input} keyboardType="number-pad" placeholder="MM/YY" />
    <Text style={styles.label}>CVV</Text>
    <TextInput style={styles.input} keyboardType="number-pad" maxLength={3} />
    <Text style={styles.label}>Cardholder Name</Text>
    <TextInput style={styles.input} />
    <TouchableOpacity style={styles.button}>
      <Text style={styles.buttonText}>Save</Text>
    </TouchableOpacity>
  </View>
);

const PayPalAuthentication = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Authenticate with PayPal</Text>
    <TouchableOpacity style={styles.button}>
      <Text style={styles.buttonText}>Log in to PayPal</Text>
    </TouchableOpacity>
  </View>
);

const ApplePayAuthentication = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Setup Apple Pay</Text>
    <TouchableOpacity style={styles.button}>
      <Text style={styles.buttonText}>Continue with Apple Pay</Text>
    </TouchableOpacity>
  </View>
);

const GooglePayAuthentication = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Setup Google Pay</Text>
    <TouchableOpacity style={styles.button}>
      <Text style={styles.buttonText}>Continue with Google Pay</Text>
    </TouchableOpacity>
  </View>
);

const DefaultPaymentScreen = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Unsupported Payment Method</Text>
  </View>
);

export default AddPaymentMethodScreen;
