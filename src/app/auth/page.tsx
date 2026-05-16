'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LayoutDashboard } from 'lucide-react'
import { login, signup, resetPassword } from './actions'
import { toast } from 'sonner'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    try {
      const result = isLogin ? await login(formData) : await signup(formData)
      if (result?.error) {
        toast.error(result.error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleForgotPassword() {
    const emailInput = document.getElementById('email') as HTMLInputElement
    const email = emailInput?.value

    if (!email) {
      toast.error('Please enter your email address first to reset your password.')
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('email', email)
      const result = await resetPassword(formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Password reset link sent to your email! Please check your inbox.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 ring-1 ring-primary/20">
            <LayoutDashboard className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-muted-foreground text-center text-sm">
            {isLogin 
              ? 'Enter your credentials to access your workspace' 
              : 'Sign up to start organizing your projects securely'}
          </p>
        </div>

        <div className="bg-card/60 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-6 sm:p-8">
          <form action={handleSubmit} className="space-y-5">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                  <Input 
                    id="fullName" 
                    name="fullName" 
                    placeholder="Jane Doe" 
                    required={!isLogin}
                    className="h-11 bg-background/50 border-border/50 focus:bg-background transition-colors"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email address</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="name@example.com" 
                required 
                className="h-11 bg-background/50 border-border/50 focus:bg-background transition-colors"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</Label>
                {isLogin && (
                  <button 
                    type="button" 
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                    className="text-xs font-medium text-primary hover:underline underline-offset-4 disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                required 
                className="h-11 bg-background/50 border-border/50 focus:bg-background transition-colors"
              />
            </div>

            <Button type="submit" className="w-full h-11 font-medium text-[15px]" disabled={isLoading}>
              {isLoading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button" 
                onClick={() => setIsLogin(!isLogin)}
                className="font-semibold text-foreground hover:text-primary transition-colors hover:underline underline-offset-4"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
