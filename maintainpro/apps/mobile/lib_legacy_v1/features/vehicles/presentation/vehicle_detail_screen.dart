import 'package:flutter/material.dart';

class VehicleDetailScreen extends StatelessWidget {
  const VehicleDetailScreen({super.key, required this.vehicleCode});

  final String vehicleCode;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Vehicle $vehicleCode')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          Card(
            child: ListTile(
              title: Text('Next Service'),
              subtitle: Text('Scheduled in 620 km'),
            ),
          ),
          Card(
            child: ListTile(
              title: Text('Fuel Consumption'),
              subtitle: Text('8.2 L/100km over last 30 days'),
            ),
          ),
          Card(
            child: ListTile(
              title: Text('Driver Assignment'),
              subtitle: Text('Alex Fernandez (Primary)'),
            ),
          ),
        ],
      ),
    );
  }
}
