import React, { useState } from 'react';
import { View, Text, Image, Button, ScrollView, TextInput, StyleSheet } from 'react-native';

export default function RenovationsScreen() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    const handleContactFormSubmit = () => {
        // Here, you can integrate your backend to send this form to your server or email
        console.log('Contact form data:', { name, email, message });
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Hardwood Flooring Renovations</Text>
            <Text style={styles.description}>Experience the beauty and elegance of our finest hardwood flooring for your home renovation needs.</Text>

            {/* Gallery */}
            <View style={styles.galleryContainer}>
                {/* Add your images */}
                {/* <Image source={...} style={styles.image} /> */}
                {/* Add as many images as required */}
            </View>

            <Text style={styles.formTitle}>Interested? Contact us:</Text>
            <TextInput placeholder="Your Name" value={name} onChangeText={setName} style={styles.input} />
            <TextInput placeholder="Your Email" value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" />
            <TextInput placeholder="Your Message" value={message} onChangeText={setMessage} style={styles.input} multiline numberOfLines={5} />
            <Button title="Submit" onPress={handleContactFormSubmit} />

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 15,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 15,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        marginVertical: 10,
    },
    galleryContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    image: {
        width: 150,
        height: 150,
        margin: 5,
    },
    formTitle: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 25,
    },
    input: {
        borderWidth: 1,
        borderColor: '#D0D0D0',
        backgroundColor: '#fff',
        padding: 10,
        marginTop: 10,
        borderRadius: 5,
        fontSize: 16,
    },
});
