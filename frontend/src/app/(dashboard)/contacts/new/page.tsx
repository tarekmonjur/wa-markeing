'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

const contactSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  name: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  city: z.string().optional(),
  business: z.string().optional(),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function NewContactPage() {
  const router = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ContactForm) => {
      const customFields: Record<string, string> = {};
      if (data.city) customFields.city = data.city;
      if (data.business) customFields.business = data.business;

      return api.post('/contacts', {
        phone: data.phone,
        name: data.name || undefined,
        email: data.email || undefined,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      });
    },
    onSuccess: () => {
      toast.success('Contact created');
      router.push('/contacts');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create contact');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Add Contact</h1>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Contact Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input id="phone" placeholder="+8801712345678" {...register('phone')} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Farhan Ahmed" {...register('name')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="farhan@example.com" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="Dhaka" {...register('city')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business">Business</Label>
                <Input id="business" placeholder="Retailer" {...register('business')} />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating...' : 'Create Contact'}
              </Button>
              <Link href="/contacts">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
