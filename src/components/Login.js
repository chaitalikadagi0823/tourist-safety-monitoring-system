import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { MapPin, Shield } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Login = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    name: '',
    emergency_contact: ''
  });

  const handleLogin = async (e, isAdmin = false) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = isAdmin ? `${API}/admin/login` : `${API}/auth/login`;
      const response = await axios.post(endpoint, loginData);
      toast.success(`Welcome back, ${response.data.user.name}!`);
      onLogin(response.data.user, response.data.access_token);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/auth/register`, registerData);
      toast.success('Registration successful! Welcome!');
      onLogin(response.data.user, response.data.access_token);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-white/20 backdrop-blur-md">
            <MapPin className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            My Tourist Guide
          </h1>
          <p className="text-teal-50 text-lg">Safe travels, smart navigation</p>
        </div>

        <Card className="glass-morphism border-white/20 shadow-2xl animate-fade-in">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Welcome</CardTitle>
            <CardDescription className="text-center">
              Login or create an account to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tourist" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6" data-testid="login-tabs">
                <TabsTrigger value="tourist" data-testid="tourist-tab">Tourist</TabsTrigger>
                <TabsTrigger value="admin" data-testid="admin-tab">Admin</TabsTrigger>
              </TabsList>

              <TabsContent value="tourist">
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="login" data-testid="tourist-login-tab">Login</TabsTrigger>
                    <TabsTrigger value="register" data-testid="tourist-register-tab">Register</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="tourist@test.com"
                          value={loginData.email}
                          onChange={(e) =>
                            setLoginData({ ...loginData, email: e.target.value })
                          }
                          required
                          data-testid="tourist-login-email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={loginData.password}
                          onChange={(e) =>
                            setLoginData({ ...loginData, password: e.target.value })
                          }
                          required
                          data-testid="tourist-login-password"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading}
                        data-testid="tourist-login-submit"
                      >
                        {isLoading ? 'Logging in...' : 'Login'}
                      </Button>
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Demo: tourist@test.com / test123
                      </p>
                    </form>
                  </TabsContent>

                  <TabsContent value="register">
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <Label htmlFor="reg-name">Full Name</Label>
                        <Input
                          id="reg-name"
                          type="text"
                          placeholder="John Doe"
                          value={registerData.name}
                          onChange={(e) =>
                            setRegisterData({ ...registerData, name: e.target.value })
                          }
                          required
                          data-testid="tourist-register-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reg-email">Email</Label>
                        <Input
                          id="reg-email"
                          type="email"
                          placeholder="you@example.com"
                          value={registerData.email}
                          onChange={(e) =>
                            setRegisterData({ ...registerData, email: e.target.value })
                          }
                          required
                          data-testid="tourist-register-email"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reg-password">Password</Label>
                        <Input
                          id="reg-password"
                          type="password"
                          placeholder="••••••••"
                          value={registerData.password}
                          onChange={(e) =>
                            setRegisterData({ ...registerData, password: e.target.value })
                          }
                          required
                          data-testid="tourist-register-password"
                        />
                      </div>
                      <div>
                        <Label htmlFor="emergency">Emergency Contact (Optional)</Label>
                        <Input
                          id="emergency"
                          type="tel"
                          placeholder="+1234567890"
                          value={registerData.emergency_contact}
                          onChange={(e) =>
                            setRegisterData({
                              ...registerData,
                              emergency_contact: e.target.value
                            })
                          }
                          data-testid="tourist-register-emergency"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isLoading}
                        data-testid="tourist-register-submit"
                      >
                        {isLoading ? 'Creating account...' : 'Create Account'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="admin">
                <form onSubmit={(e) => handleLogin(e, true)} className="space-y-4">
                  <div className="flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <Label htmlFor="admin-email">Admin Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@tourist.com"
                      value={loginData.email}
                      onChange={(e) =>
                        setLoginData({ ...loginData, email: e.target.value })
                      }
                      required
                      data-testid="admin-login-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="admin-password">Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                      required
                      data-testid="admin-login-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    disabled={isLoading}
                    data-testid="admin-login-submit"
                  >
                    {isLoading ? 'Logging in...' : 'Admin Login'}
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Demo: admin@tourist.com / admin123
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;