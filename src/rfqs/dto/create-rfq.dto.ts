export class CreateRfqDto {
  origin!: string;
  destination!: string;
  cargoType!: string;
  weight?: string | number;
  volume?: string | number;
  pickupDate?: string;
  deliveryDate?: string;
  notes?: string;
}
