import { Body, Controller,Get,Param,Post,Req } from "@nestjs/common";
import { LoginWorkmanDto } from "../dtos/workman/login.workman.dto";
import { WorkmanService } from "../services/workman/workman.service";
import ApiResponse from "../misc/api.response.class";
import { CompanyService } from "../services/company/company.service";
import { JwtRefreshDataDto } from "../dtos/auth/jwt.refresh.data.dto";
import { Request } from "express";
import { jwtRefreshSecret, jwtTokenValidationSecret, jwtValidationSecret } from "../../config/jwt.secret";
import * as jwt from "jsonwebtoken";
import { LoginWorkmanInfoDto } from "../dtos/workman/login.workman.info.dto";
import { JwtDataCompanyTokenValidation } from "../dtos/company/jwt.data.company.token.validation";
import { CompanyMailer } from "../services/company/company.mailer.service";
import { Workman } from "../entities/workman.entity";
import { JwtDataWorkmanValidationDto } from "../dtos/workman/jwt.data.workman.validation.dto";
import { AddWorkmanDto } from "../dtos/workman/add.workman.dto";
import { WorkmanMailer } from "../services/workman/workman.mailer.service";
import { CompanyRefreshTokenDto } from "../dtos/company/company.refresh.token.dto";


@Controller("auth") 
export class AuthController{

    constructor(
        private readonly workmanService:WorkmanService,
        private readonly companyService:CompanyService,
        private readonly companyMailer:CompanyMailer,
        private readonly workmanMailer:WorkmanMailer
    ){}

    @Post("workman/login")
    async  workmanLogin(@Body() data:LoginWorkmanDto,@Req() req:Request){
        const workman = await this.workmanService.getByEmail(data.email);
        if(!workman)
            return new ApiResponse("error",-2002);

        
        if(workman.isValid[0]===0)
            return new ApiResponse("error",-3003)

        const company= await this.companyService.getByCompanyName(data.companyName);
        if(!company)
            return new ApiResponse("error",-1002);

        if(company.companyId!==workman.companyId)
            return new ApiResponse("error",-3001);

        const crypto=require("crypto");
        const passwordHash=crypto.createHash("sha512");
        passwordHash.update(data.password);
        const passwordHashString=passwordHash.digest("hex").toUpperCase();

        if(passwordHashString!==company.passwordHash)
            return new ApiResponse("error",-3002);

        const jwtRefreshData=new JwtRefreshDataDto();
        jwtRefreshData.role="workman";
        jwtRefreshData.identity=workman.email;
        jwtRefreshData.id=workman.workmanId;
        jwtRefreshData.companyId=workman.companyId;
        jwtRefreshData.ip=req.ip.toString();
        jwtRefreshData.ua=req.headers["user-agent"];

        let currentTime=new Date();
        currentTime.setDate(currentTime.getDate()+14);
        const expires=currentTime.getTime()/1000;

        jwtRefreshData.exp=expires;

        const refresToken=jwt.sign(jwtRefreshData.toPlain(),jwtRefreshSecret);

        const newCompanyToken=await this.companyService.addToken(refresToken,company.companyId,workman.workmanId,currentTime);

        const loginInfo=new LoginWorkmanInfoDto();
        loginInfo.refreshToken=refresToken;

        const jwtValidationData:JwtDataCompanyTokenValidation=new JwtDataCompanyTokenValidation();
        jwtValidationData.companyTokenId=newCompanyToken.companyTokenId;
        jwtValidationData.workmanId=workman.workmanId;

        const validationTokenExp=new Date();
        validationTokenExp.setMinutes(validationTokenExp.getMinutes()+2);

        jwtValidationData.exp=validationTokenExp.getTime()/1000;

        const validationToken=jwt.sign(jwtValidationData.toPlain(),jwtTokenValidationSecret)

        this.companyMailer.sendValidationEmail(validationToken,data.email);
        
        return loginInfo;

    }
    @Get("validateCompanyToken/:token")
    async validateCompanyToken(@Param("token") token:string){
        let jwtData:JwtDataCompanyTokenValidation;

        try{
            jwtData=jwt.verify(token,jwtTokenValidationSecret);
        }catch(e){
            return new ApiResponse("error",-3005,"Vrijeme za validaciju je isteklo!");
        }
       
        
        if(!jwtData.companyTokenId || !jwtData.exp || !jwtData.workmanId)
            return new ApiResponse("error",-3006);

        await this.companyService.invalidateTokens(jwtData.workmanId);

        return await this.companyService.validateToken(jwtData.companyTokenId);
    }
    @Post("newWorkman")
    async newWorkman(@Body() data:AddWorkmanDto){
        const company=await this.companyService.getByCompanyName(data.companyName);
        if(!company)
            return new ApiResponse("error",-1002,"");

        const crypto=require("crypto");
        const passwordHash=crypto.createHash("sha512");
        passwordHash.update(data.password);
        const passwordHashString=passwordHash.digest("hex").toUpperCase();

    
        if(passwordHashString!==company.passwordHash)
            return new ApiResponse("error",-1003);

        const newWorkman:Workman=await this.workmanService.registerNew(data,company.companyId);
        if(!newWorkman)
            return new ApiResponse("error",-1004);

        const jwtData:JwtDataWorkmanValidationDto=new JwtDataWorkmanValidationDto(newWorkman.workmanId);
        
        let token=jwt.sign(jwtData.toPlainObject(),jwtValidationSecret);
        
        this.workmanMailer.sendValidationEmail(token,newWorkman.email)

        return newWorkman;
    }
    @Get("validateWorkman/:token")
    async validateWorkman(@Param("token") token:string){
        let jwtData:JwtDataWorkmanValidationDto;

        try{
            jwtData=jwt.verify(token,jwtValidationSecret);
        }catch(e){
            return new ApiResponse("error",-1005);
        }
        if(!jwtData || !jwtData.workmanId)
            return new ApiResponse("error",-1005);

        return await this.workmanService.validateWorkman(jwtData.workmanId)
    }

    @Post("company/refresh")
    refreshCompanyToken(data:CompanyRefreshTokenDto){

    }

}