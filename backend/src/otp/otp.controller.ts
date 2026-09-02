import { Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SendOtpDto, VerifyOtpDto } from "./otp.dto";
import { OtpService } from "./otp.service";

@ApiTags("auth-otp")
@Controller({ path: "auth/otp", version: "1" })
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  @Post("send")
  @ApiOperation({ summary: "Send borrower phone OTP via ExciteSMS (public)" })
  send(@Body() dto: SendOtpDto) {
    return this.otp.send(dto);
  }

  @Post("verify")
  @ApiOperation({ summary: "Verify borrower phone OTP and issue a magic-link token hash (public)" })
  verify(@Body() dto: VerifyOtpDto) {
    return this.otp.verify(dto);
  }
}
