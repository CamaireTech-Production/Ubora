import React, { useState, useEffect } from 'react';
import { PaymentService } from '../services/paymentService';
import { Payment } from '../types/payment';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './Card';
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar,
  DollarSign
} from 'lucide-react';

interface PaymentHistoryProps {
  limit?: number;
  showTitle?: boolean;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({ 
  limit = 10, 
  showTitle = true 
}) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadPayments();
    }
  }, [user, limit]);

  const loadPayments = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userPayments = await PaymentService.getUserPayments(user.id, limit);
      setPayments(userPayments);
    } catch (err) {
      setError('Erreur lors du chargement de l\'historique des paiements');
      console.error('Error loading payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return 'Payé';
      case 'failed':
        return 'Échoué';
      case 'cancelled':
        return 'Annulé';
      case 'pending':
        return 'En attente';
      default:
        return 'Inconnu';
    }
  };

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'cancelled':
        return 'text-gray-600 bg-gray-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <Card>
        {showTitle && <h3 className="text-lg font-semibold mb-4">Historique des paiements</h3>}
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        {showTitle && <h3 className="text-lg font-semibold mb-4">Historique des paiements</h3>}
        <div className="text-center py-8">
          <p className="text-red-600">{error}</p>
        </div>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        {showTitle && <h3 className="text-lg font-semibold mb-4">Historique des paiements</h3>}
        <div className="text-center py-8">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Aucun paiement trouvé</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {showTitle && <h3 className="text-lg font-semibold mb-4">Historique des paiements</h3>}
      
      <div className="space-y-4">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                {getStatusIcon(payment.status)}
                <div>
                  <h4 className="font-medium text-gray-900">{payment.description}</h4>
                  <p className="text-sm text-gray-500">
                    {payment.metadata?.packageType && (
                      <span className="capitalize">{payment.metadata.packageType}</span>
                    )}
                    {payment.metadata?.sessionType && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {payment.metadata.sessionType}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center space-x-1 text-lg font-semibold text-gray-900">
                  <DollarSign className="h-4 w-4" />
                  <span>{payment.amount.toLocaleString('fr-FR')} {payment.currency}</span>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                  {getStatusText(payment.status)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(payment.createdAt)}</span>
              </div>
              
              {payment.campayReference && (
                <div className="text-xs">
                  Ref: {payment.campayReference}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
