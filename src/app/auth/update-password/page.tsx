'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound } from 'lucide-react'
import { updatePassword } from '../actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    try {
      const password = formData.get('password') as string
      const confirmPassword = formData.get('confirmPassword') as string
      
      if (password !== confirmPassword) {
        toast.error('Passwords do not match')
        return
      }

      const result = await updatePassword(formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Password updated successfully!')
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to update password')
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
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
            Update Password
          </h1>
          <p className="text-muted-foreground text-center text-sm">
            Please enter your new password below.
          </p>
        </div>

        <div className="bg-card/60 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-6 sm:p-8">
          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Password</Label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                required 
                minLength={6}
                className="h-11 bg-background/50 border-border/50 focus:bg-background transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm New Password</Label>
              <Input 
                id="confirmPassword" 
                name="confirmPassword" 
                type="password" 
                required 
                minLength={6}
                className="h-11 bg-background/50 border-border/50 focus:bg-background transition-colors"
              />
            </div>

            <Button type="submit" className="w-full h-11 font-medium text-[15px]" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border/50 text-center">
             <button 
                type="button" 
                onClick={() => router.push('/auth')}
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors hover:underline underline-offset-4"
              >
                Back to Sign in
              </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
