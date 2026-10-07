export type TradingSegment = 'EQUITY' | 'OPTION' | 'FUTURE';
export type OrderSide = 'BUY' | 'SELL';
export type OrderProduct = 'INTRADAY' | 'DELIVERY'; // MIS vs CNC/NRML
export type OrderType = 'MARKET' | 'LIMIT' | 'SL';
export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
export type PositionStatus = 'OPEN' | 'CLOSED';

export interface Order {
  id: string;
  timestamp: number;
  symbol: string;
  name: string;
  segment: TradingSegment;
  side: OrderSide;
  product: OrderProduct;
  type: OrderType;
  quantity: number;
  price: number;
  triggerPrice?: number;
  status: OrderStatus;
  filledPrice?: number;
  filledTimestamp?: number;
  contractDetails?: {
    strikePrice?: number;
    optionType?: 'CE' | 'PE';
    expiryDate?: string;
    lotSize?: number;
  };
}

export interface Position {
  id: string;
  symbol: string;
  name: string;
  segment: TradingSegment;
  side: OrderSide; // NET side
  product: OrderProduct;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPerc: number;
  realizedPnL: number;
  marginUsed: number;
  openedAt: number;
  status: PositionStatus;
  closedAt?: number;
  exitPrice?: number;
  contractDetails?: {
    strikePrice?: number;
    optionType?: 'CE' | 'PE';
    expiryDate?: string;
    lotSize?: number;
  };
}

export interface PortfolioSummary {
  startingBalance: number;
  availableCash: number;
  usedMargin: number;
  totalAccountValue: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  netPnL: number;
}
