import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch,StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const PrivacyOptionsScreen = () => {
  const [dataSharing, setDataSharing] = React.useState(true);
  const [marketingEmails, setMarketingEmails] = React.useState(true);
  const [targetedAds, setTargetedAds] = React.useState(true);

  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Options</Text>
      </View>

      <ScrollView style={styles.settingsList}>
        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Data Sharing with Partners</Text>
          <Switch
            trackColor={{ false: "#E0E0E0", true: "#3498db" }}
            thumbColor={dataSharing ? "#FFF" : "#f4f3f4"}
            onValueChange={() => setDataSharing(prev => !prev)}
            value={dataSharing}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Receive Marketing Emails</Text>
          <Switch
            trackColor={{ false: "#E0E0E0", true: "#3498db" }}
            thumbColor={marketingEmails ? "#FFF" : "#f4f3f4"}
            onValueChange={() => setMarketingEmails(prev => !prev)}
            value={marketingEmails}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Receive Targeted Ads</Text>
          <Switch
            trackColor={{ false: "#E0E0E0", true: "#3498db" }}
            thumbColor={targetedAds ? "#FFF" : "#f4f3f4"}
            onValueChange={() => setTargetedAds(prev => !prev)}
            value={targetedAds}
          />
        </View>

        <Text style={{ ...styles.label, paddingHorizontal: 15, paddingTop: 20 }}>
          Note: Disabling some of these options may affect your user experience. We are committed to respecting your privacy choices.
        </Text>
      </ScrollView>
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
    height: 60, // You can adjust based on your device's status bar height
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
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    marginBottom: 20,
    lineHeight: 20,
  },
});

export default PrivacyOptionsScreen;




