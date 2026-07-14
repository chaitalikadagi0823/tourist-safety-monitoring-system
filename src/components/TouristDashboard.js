import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { AlertCircle, MapPin, Cloud, Star, LogOut, Navigation, MessageSquare } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

const LocationUpdater = ({ onLocationUpdate }) => {
  const map = useMap();

  useEffect(() => {
    const updateLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            onLocationUpdate(latitude, longitude);
            map.setView([latitude, longitude], 13);
          },
          (error) => {
            console.error('Location error:', error);
          }
        );
      }
    };

    updateLocation();
    const interval = setInterval(updateLocation, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [map, onLocationUpdate]);

  return null;
};

const TouristDashboard = ({ user, onLogout }) => {
  const [location, setLocation] = useState({ lat: 20.5937, lng: 78.9629 }); // India center
  const [zones, setZones] = useState([]);
  const [weather, setWeather] = useState(null);
  const [sosMessage, setSosMessage] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSOSDialogOpen, setIsSOSDialogOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchZones();
    fetchWeather();
  }, []);

  const fetchZones = async () => {
    try {
      const response = await axios.get(`${API}/zones`);
      setZones(response.data);
    } catch (error) {
      console.error('Error fetching zones:', error);
    }
  };

  const fetchWeather = async () => {
    try {
      const response = await axios.get(`${API}/weather`, {
        params: { lat: location.lat, lon: location.lng }
      });
      setWeather(response.data);
    } catch (error) {
      console.error('Error fetching weather:', error);
    }
  };

  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      // Using OpenStreetMap Nominatim for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=in`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newLocation = { lat: parseFloat(lat), lng: parseFloat(lon) };
        setLocation(newLocation);
        await handleLocationUpdate(parseFloat(lat), parseFloat(lon));
        toast.success(`Location found: ${data[0].display_name}`);
      } else {
        toast.error('Location not found in India');
      }
    } catch (error) {
      toast.error('Failed to search location');
    }
  };

  const handleLocationUpdate = async (lat, lng) => {
    setLocation({ lat, lng });
    try {
      await axios.post(`${API}/location/update`, {
        latitude: lat,
        longitude: lng
      });
      // Fetch weather for new location
      const weatherResponse = await axios.get(`${API}/weather`, {
        params: { lat, lon: lng }
      });
      setWeather(weatherResponse.data);
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const handleSendSOS = async () => {
    try {
      await axios.post(`${API}/sos`, {
        latitude: location.lat,
        longitude: location.lng,
        message: sosMessage
      });
      toast.success('SOS alert sent successfully! Help is on the way.');
      setIsSOSDialogOpen(false);
      setSosMessage('');
    } catch (error) {
      toast.error('Failed to send SOS alert');
    }
  };

  const handleSubmitFeedback = async () => {
    try {
      await axios.post(`${API}/feedback`, {
        rating: feedbackRating,
        comment: feedbackComment
      });
      toast.success('Thank you for your feedback!');
      setIsFeedbackDialogOpen(false);
      setFeedbackRating(5);
      setFeedbackComment('');
    } catch (error) {
      toast.error('Failed to submit feedback');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-500 to-cyan-600 shadow-lg">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MapPin className="w-8 h-8 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white">My Tourist Guide</h1>
                <p className="text-sm text-teal-100">Welcome, {user.name}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={onLogout} 
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex h-[calc(100vh-80px)]">
        {/* Left Sidebar */}
        <div className="w-80 bg-white shadow-lg overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Search Location */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Search Location</h2>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter city or place name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchLocation()}
                  className="flex-1"
                  data-testid="search-location-input"
                />
                <Button 
                  onClick={handleSearchLocation}
                  className="bg-gray-900 hover:bg-gray-800"
                  data-testid="search-button"
                >
                  <Navigation className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Dialog open={isSOSDialogOpen} onOpenChange={setIsSOSDialogOpen}>
                  <DialogTrigger asChild>
                    <button 
                      className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                      data-testid="sos-trigger-button"
                    >
                      <AlertCircle className="w-5 h-5" />
                      <span>SOS - Emergency Alert</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent data-testid="sos-dialog">
                    <DialogHeader>
                      <DialogTitle>Send SOS Alert</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Your current location will be sent</Label>
                        <p className="text-sm text-gray-500">
                          Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="sos-message">Message (Optional)</Label>
                        <Textarea
                          id="sos-message"
                          placeholder="Describe your emergency..."
                          value={sosMessage}
                          onChange={(e) => setSosMessage(e.target.value)}
                          data-testid="sos-message-input"
                        />
                      </div>
                      <Button
                        onClick={handleSendSOS}
                        className="w-full bg-red-600 hover:bg-red-700"
                        data-testid="sos-send-button"
                      >
                        Send SOS Alert
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
                  <DialogTrigger asChild>
                    <button 
                      className="w-full bg-white border-2 border-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center space-x-2"
                      data-testid="feedback-trigger-button"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>Leave Feedback</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent data-testid="feedback-dialog">
                    <DialogHeader>
                      <DialogTitle>Share Your Feedback</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="rating">Rating</Label>
                        <div className="flex space-x-2 mt-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setFeedbackRating(star)}
                              className="focus:outline-none"
                              data-testid={`rating-star-${star}`}
                            >
                              <Star
                                className={`w-8 h-8 ${
                                  star <= feedbackRating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="feedback-comment">Comment (Optional)</Label>
                        <Textarea
                          id="feedback-comment"
                          placeholder="Tell us about your experience..."
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          data-testid="feedback-comment-input"
                        />
                      </div>
                      <Button
                        onClick={handleSubmitFeedback}
                        className="w-full"
                        data-testid="feedback-submit-button"
                      >
                        Submit Feedback
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Zone Safety Levels */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Zone Safety Levels</h2>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="text-gray-700 font-medium">Safe Zone</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-700 font-medium">Caution Zone</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span className="text-gray-700 font-medium">Danger Zone</span>
                </div>
              </div>
            </div>

            {/* Weather Card */}
            {weather && (
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center space-x-2 mb-3">
                  <Cloud className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Weather</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-gray-900">
                      {weather.temperature}°C
                    </span>
                    <span className="text-lg font-medium text-gray-700">
                      {weather.condition}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-200 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Humidity</span>
                      <span className="font-medium">{weather.humidity}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Wind Speed</span>
                      <span className="font-medium">{weather.wind_speed} km/h</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <MapContainer
            center={[location.lat, location.lng]}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationUpdater onLocationUpdate={handleLocationUpdate} />
            <Marker position={[location.lat, location.lng]}>
              <Popup>Your current location</Popup>
            </Marker>
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
                  <div>
                    <strong>{zone.name}</strong>
                    <br />
                    <span className={`zone-badge ${zone.type}`}>{zone.type}</span>
                  </div>
                </Popup>
              </Polygon>
            ))}
          </MapContainer>
        </div>
      </main>
    </div>
  );
};

export default TouristDashboard;