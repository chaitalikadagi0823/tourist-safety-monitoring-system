import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Shield, Users, AlertTriangle, MessageSquare, LogOut, Trash2, Edit } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

const AdminDashboard = ({ user, onLogout }) => {
  const [zones, setZones] = useState([]);
  const [tourists, setTourists] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [newZone, setNewZone] = useState(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneType, setNewZoneType] = useState('safe');
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [zonesRes, touristsRes, sosRes, feedbackRes] = await Promise.all([
        axios.get(`${API}/zones`),
        axios.get(`${API}/tourists/active`),
        axios.get(`${API}/sos`),
        axios.get(`${API}/feedback`)
      ]);
      setZones(zonesRes.data);
      setTourists(touristsRes.data);
      setSosAlerts(sosRes.data);
      setFeedback(feedbackRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleZoneCreated = (e) => {
    const layer = e.layer;
    const coordinates = layer.getLatLngs()[0].map((latlng) => [latlng.lat, latlng.lng]);
    setNewZone(coordinates);
    setIsZoneDialogOpen(true);
  };

  const startDrawing = () => {
    setDrawingMode(true);
    setDrawingPoints([]);
    toast.info('Click on the map to add points for the zone. Click "Finish Drawing" when done.');
  };

  const finishDrawing = () => {
    if (drawingPoints.length < 3) {
      toast.error('Please add at least 3 points to create a zone');
      return;
    }
    setNewZone(drawingPoints);
    setDrawingMode(false);
    setIsZoneDialogOpen(true);
  };

  const cancelDrawing = () => {
    setDrawingMode(false);
    setDrawingPoints([]);
  };

  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        if (drawingMode) {
          setDrawingPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
        }
      }
    });
    return null;
  };

  const handleCreateZone = async () => {
    if (!newZoneName || !newZone) {
      toast.error('Please provide a zone name');
      return;
    }

    try {
      await axios.post(`${API}/zones`, {
        name: newZoneName,
        type: newZoneType,
        coordinates: newZone
      });
      toast.success('Zone created successfully');
      setIsZoneDialogOpen(false);
      setNewZoneName('');
      setNewZoneType('safe');
      setNewZone(null);
      setDrawingPoints([]);
      fetchData();
    } catch (error) {
      toast.error('Failed to create zone');
    }
  };

  const handleDeleteZone = async (zoneId) => {
    try {
      await axios.delete(`${API}/zones/${zoneId}`);
      toast.success('Zone deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete zone');
    }
  };

  const handleResolveSOS = async (sosId) => {
    try {
      await axios.patch(`${API}/sos/${sosId}/resolve`);
      toast.success('SOS alert resolved');
      fetchData();
    } catch (error) {
      toast.error('Failed to resolve SOS alert');
    }
  };

  const getZoneColor = (type) => {
    switch (type) {
      case 'safe':
        return '#10b981';
      case 'caution':
        return '#f59e0b';
      case 'danger':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const activeAlerts = sosAlerts.filter((alert) => alert.status === 'active');
  const averageRating =
    feedback.length > 0
      ? (feedback.reduce((sum, fb) => sum + fb.rating, 0) / feedback.length).toFixed(1)
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome, {user.name}</p>
              </div>
            </div>
            <Button variant="outline" onClick={onLogout} data-testid="admin-logout-button">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="stat-card" data-testid="tourists-stat">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Tourists</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{tourists.length}</p>
                </div>
                <Users className="w-10 h-10 text-teal-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card" data-testid="zones-stat">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Safety Zones</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{zones.length}</p>
                </div>
                <Shield className="w-10 h-10 text-indigo-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card" data-testid="sos-stat">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active SOS Alerts</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">{activeAlerts.length}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card" data-testid="feedback-stat">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg. Rating</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">{averageRating} / 5</p>
                </div>
                <MessageSquare className="w-10 h-10 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="map" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4" data-testid="admin-tabs">
            <TabsTrigger value="map" data-testid="map-tab">Map & Zones</TabsTrigger>
            <TabsTrigger value="tourists" data-testid="tourists-tab">Tourists</TabsTrigger>
            <TabsTrigger value="sos" data-testid="sos-tab">
              SOS Alerts {activeAlerts.length > 0 && `(${activeAlerts.length})`}
            </TabsTrigger>
            <TabsTrigger value="feedback" data-testid="feedback-tab">Feedback</TabsTrigger>
          </TabsList>

          {/* Map Tab */}
          <TabsContent value="map">
            <Card className="shadow-lg" data-testid="admin-map-card">
              <CardHeader>
                <CardTitle>Geo-Fencing Management</CardTitle>
                <p className="text-sm text-gray-500">
                  Click "Start Drawing" to create a zone by clicking points on the map
                </p>
                <div className="flex space-x-2 mt-4">
                  {!drawingMode ? (
                    <Button onClick={startDrawing} data-testid="start-drawing-button">
                      <Edit className="w-4 h-4 mr-2" />
                      Start Drawing Zone
                    </Button>
                  ) : (
                    <>
                      <Button onClick={finishDrawing} data-testid="finish-drawing-button">
                        Finish Drawing ({drawingPoints.length} points)
                      </Button>
                      <Button variant="outline" onClick={cancelDrawing} data-testid="cancel-drawing-button">
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="admin-map-container">
                  <MapContainer
                    center={[20.5937, 78.9629]}
                    zoom={5}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler />
                    {drawingPoints.length > 0 && (
                      <>
                        {drawingPoints.map((point, idx) => (
                          <Marker key={idx} position={point}>
                            <Popup>Point {idx + 1}</Popup>
                          </Marker>
                        ))}
                        {drawingPoints.length > 2 && (
                          <Polygon
                            positions={drawingPoints}
                            pathOptions={{
                              color: '#3498db',
                              fillColor: '#3498db',
                              fillOpacity: 0.3
                            }}
                          />
                        )}
                      </>
                    )}
                    {zones.map((zone) => (
                      <Polygon
                        key={zone.id}
                        positions={zone.coordinates}
                        pathOptions={{
                          color: getZoneColor(zone.type),
                          fillColor: getZoneColor(zone.type),
                          fillOpacity: 0.3
                        }}
                      >
                        <Popup>
                          <div className="space-y-2">
                            <div>
                              <strong>{zone.name}</strong>
                              <br />
                              <span className={`zone-badge ${zone.type}`}>{zone.type}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteZone(zone.id)}
                              data-testid={`delete-zone-${zone.id}`}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </Popup>
                      </Polygon>
                    ))}
                    {tourists.map((tourist) =>
                      tourist.last_latitude && tourist.last_longitude ? (
                        <Marker
                          key={tourist.id}
                          position={[tourist.last_latitude, tourist.last_longitude]}
                        >
                          <Popup>
                            <strong>{tourist.name}</strong>
                            <br />
                            {tourist.email}
                          </Popup>
                        </Marker>
                      ) : null
                    )}
                  </MapContainer>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Existing Zones</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {zones.map((zone) => (
                      <div
                        key={zone.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{zone.name}</p>
                          <span className={`zone-badge ${zone.type} mt-1`}>{zone.type}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteZone(zone.id)}
                          data-testid={`zone-delete-${zone.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tourists Tab */}
          <TabsContent value="tourists">
            <Card className="shadow-lg" data-testid="tourists-list-card">
              <CardHeader>
                <CardTitle>Active Tourists</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tourists.length === 0 ? (
                    <p className="text-gray-500">No active tourists</p>
                  ) : (
                    tourists.map((tourist) => (
                      <div
                        key={tourist.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{tourist.name}</p>
                          <p className="text-sm text-gray-500">{tourist.email}</p>
                          {tourist.emergency_contact && (
                            <p className="text-sm text-gray-500">
                              Emergency: {tourist.emergency_contact}
                            </p>
                          )}
                        </div>
                        {tourist.last_latitude && tourist.last_longitude && (
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Last Location</p>
                            <p className="text-sm font-mono">
                              {tourist.last_latitude.toFixed(4)}, {tourist.last_longitude.toFixed(4)}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SOS Tab */}
          <TabsContent value="sos">
            <Card className="shadow-lg" data-testid="sos-list-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                  SOS Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sosAlerts.length === 0 ? (
                    <p className="text-gray-500">No SOS alerts</p>
                  ) : (
                    sosAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-lg border ${
                          alert.status === 'active'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <p className="font-medium text-gray-900">{alert.user_name}</p>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  alert.status === 'active'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-600 text-white'
                                }`}
                              >
                                {alert.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{alert.user_email}</p>
                            {alert.message && (
                              <p className="text-sm text-gray-700 mt-2">
                                Message: {alert.message}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Location: {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(alert.created_at).toLocaleString()}
                            </p>
                          </div>
                          {alert.status === 'active' && (
                            <Button
                              size="sm"
                              onClick={() => handleResolveSOS(alert.id)}
                              data-testid={`resolve-sos-${alert.id}`}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback">
            <Card className="shadow-lg" data-testid="feedback-list-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>User Feedback</span>
                  <span className="text-2xl font-bold text-yellow-600">
                    {averageRating} / 5
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {feedback.length === 0 ? (
                    <p className="text-gray-500">No feedback yet</p>
                  ) : (
                    feedback.map((fb) => (
                      <div key={fb.id} className="p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{fb.user_name}</p>
                            <div className="flex items-center mt-1">
                              {[...Array(5)].map((_, i) => (
                                <span
                                  key={i}
                                  className={`text-lg ${
                                    i < fb.rating ? 'text-yellow-400' : 'text-gray-300'
                                  }`}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(fb.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {fb.comment && (
                          <p className="text-sm text-gray-700 mt-2">{fb.comment}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Zone Creation Dialog */}
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent data-testid="zone-dialog">
          <DialogHeader>
            <DialogTitle>Create Safety Zone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="zone-name">Zone Name</Label>
              <Input
                id="zone-name"
                placeholder="e.g., Downtown Area"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                data-testid="zone-name-input"
              />
            </div>
            <div>
              <Label htmlFor="zone-type">Zone Type</Label>
              <Select value={newZoneType} onValueChange={setNewZoneType}>
                <SelectTrigger data-testid="zone-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="safe">Safe</SelectItem>
                  <SelectItem value="caution">Caution</SelectItem>
                  <SelectItem value="danger">Danger</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateZone} className="w-full" data-testid="zone-create-button">
              Create Zone
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;