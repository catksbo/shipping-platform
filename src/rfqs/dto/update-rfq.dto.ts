export class UpdateRfqDto {
  origin?: string;
  destination?: string;
  cargoType?: string;
  weight?: string | number | null;
  volume?: string | number | null;
  pickupDate?: string | null;
  deliveryDate?: string | null;
  notes?: string | null;
}
