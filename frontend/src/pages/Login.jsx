import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data) => {
    setError('');
    const result = await login(data.username, data.password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-accent">
          <Monitor className="w-16 h-16" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Cyber Cafe Pro
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          Sign in to manage your cafe
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs font-semibold space-y-1">
                <p className="font-bold">{error}</p>
                <p className="text-gray-600 font-normal">If you just deployed to Render free tier, the server may take up to 40 seconds to wake up on the first request.</p>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Username</label>
              <div className="mt-1">
                <input
                  {...register('username')}
                  type="text"
                  placeholder="admin"
                  defaultValue="admin"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary text-sm"
                />
                {errors.username && <p className="mt-1 text-xs text-red-600 font-semibold">{errors.username.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Password</label>
              <div className="mt-1">
                <input
                  {...register('password')}
                  type="password"
                  placeholder="admin123"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary text-sm"
                />
                {errors.password && <p className="mt-1 text-xs text-red-600 font-semibold">{errors.password.message}</p>}
              </div>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 p-2.5 rounded-lg text-xs text-blue-800">
              <span className="font-bold">Default Admin:</span> <code>admin</code> / <code>admin123</code>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow text-sm font-bold text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? 'Signing in (Connecting to server)...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
