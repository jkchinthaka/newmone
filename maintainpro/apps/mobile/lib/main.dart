import 'package:flutter/material.dart';

void main() {
  runApp(const MaintainProApp());
}

class MaintainProApp extends StatelessWidget {
  const MaintainProApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MaintainPro',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('MaintainPro Mobile'),
      ),
      body: const Center(
        child: Text(
          'CMMS mobile workspace is ready.',
          style: TextStyle(fontSize: 16),
        ),
      ),
    );
  }
}
